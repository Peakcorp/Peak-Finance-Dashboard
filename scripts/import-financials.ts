/**
 * One-off importer for a General Ledger export (revenue/expense financials).
 * Run with: npx tsx scripts/import-financials.ts "<path-to-xlsx>"
 *
 * Parses the GL, matches loan-linkable transactions (revenue + direct cost accounts)
 * to existing closed_loans by borrower last name + property address + date proximity,
 * and inserts everything into the isolated financials_uploads / gl_transactions tables.
 * Nothing in the existing schema is touched — see supabase/financials-schema.sql.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { parseGLWorkbook } from '../lib/glParser'
import { matchTransactionsToLoans } from '../lib/glMatcher'
import type { ClosedLoan } from '../lib/types'

const BATCH_SIZE = 200

async function fetchAllClosedLoans(supabase: any): Promise<ClosedLoan[]> {
  const all: ClosedLoan[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from('closed_loans').select('*').range(from, from + 999)
    if (error) throw error
    all.push(...((data ?? []) as ClosedLoan[]))
    if (!data || data.length < 1000) break
    from += 1000
  }
  return all
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filePath = args.find((a) => !a.startsWith('--'))
  if (!filePath) {
    console.error('Usage: npx tsx scripts/import-financials.ts "<path-to-xlsx>" [--dry-run]')
    process.exit(1)
  }
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`)
    process.exit(1)
  }
  if (dryRun) console.log('*** DRY RUN — no data will be written to the database ***\n')

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, serviceRoleKey)

  console.log(`Reading ${filePath}...`)
  const buffer = fs.readFileSync(filePath)
  const parsed = parseGLWorkbook(buffer)
  console.log(`Period: ${parsed.periodStart} to ${parsed.periodEnd}`)
  console.log(`Total transactions parsed: ${parsed.transactions.length}`)
  console.log(`\nAccount breakdown:`)
  for (const a of parsed.accountSummary) {
    console.log(`  [${a.category}] ${a.code} - ${a.name}: ${a.count} rows`)
  }

  console.log(`\nFetching closed_loans for matching...`)
  const closedLoans = await fetchAllClosedLoans(supabase)
  console.log(`Loaded ${closedLoans.length} closed loans.`)

  // GL entries dated before the earliest loan in the system can't be tied to any loan and
  // would just be noise in the P&L (revenue/expense with nothing on the other side) — excluded
  // wholesale, not just from matching. Cutoff is derived from the live data, not hand-picked.
  const earliestCompletionDates = closedLoans
    .map((l) => l.milestone_date_completion)
    .filter((d): d is string => d !== null)
    .sort()
  const cutoffDate = earliestCompletionDates[0]
  if (!cutoffDate) {
    console.error('No closed loans with a completion date found — cannot compute a cutoff date.')
    process.exit(1)
  }
  console.log(`\nEarliest closed loan completion date in the system: ${cutoffDate}`)

  const beforeCutoff = parsed.transactions.filter((t) => !t.postedDate || t.postedDate < cutoffDate)
  const inScope = parsed.transactions.filter((t) => t.postedDate && t.postedDate >= cutoffDate)
  console.log(`Excluding ${beforeCutoff.length} transactions posted before ${cutoffDate} (or with no posted date).`)
  console.log(`${inScope.length} transactions remain in scope for import.`)

  const matched = matchTransactionsToLoans(inScope, closedLoans)

  const loanLinkable = matched.filter((t) => t.glCategory !== 'overhead')
  const matchedCount = loanLinkable.filter((t) => t.matchedClosedLoanId).length
  const highCount = loanLinkable.filter((t) => t.matchConfidence === 'high').length
  const mediumCount = loanLinkable.filter((t) => t.matchConfidence === 'medium').length
  const unmatched = loanLinkable.filter((t) => !t.matchedClosedLoanId)

  console.log(`\n=== Match report (revenue + direct expense only, overhead is never loan-linked) ===`)
  console.log(`Loan-linkable transactions: ${loanLinkable.length}`)
  console.log(`Matched: ${matchedCount} (${((matchedCount / loanLinkable.length) * 100).toFixed(1)}%) — high: ${highCount}, medium: ${mediumCount}`)
  console.log(`Unmatched: ${unmatched.length}`)
  if (unmatched.length) {
    console.log(`\nFirst 20 unmatched transactions (for review):`)
    unmatched.slice(0, 20).forEach((t) => {
      console.log(`  [${t.glAccountName}] ${t.postedDate} | ${t.amount.toFixed(2)} | ref: loan#${t.loanNumberRef ?? '—'} name:${t.borrowerLastNameRef ?? '—'} addr:${t.propertyAddressRef ?? '—'} | memo: ${t.memo}`)
    })
  }

  const categoryTotals = { revenue: 0, direct_expense: 0, overhead: 0 }
  for (const t of matched) categoryTotals[t.glCategory] += t.amount
  console.log(`\n=== Category totals (should match the source GL, minus the excluded pre-cutoff rows) ===`)
  console.log(`Revenue: $${categoryTotals.revenue.toFixed(2)}`)
  console.log(`Direct expense: $${categoryTotals.direct_expense.toFixed(2)}`)
  console.log(`Overhead: $${categoryTotals.overhead.toFixed(2)}`)
  console.log(`Net (revenue - direct expense - overhead): $${(categoryTotals.revenue - categoryTotals.direct_expense - categoryTotals.overhead).toFixed(2)}`)

  if (dryRun) {
    console.log('\n*** DRY RUN — nothing was written. Re-run without --dry-run to import. ***')
    return
  }

  const inScopeDates = inScope.map((t) => t.postedDate).filter((d): d is string => d !== null).sort()
  const periodStart = inScopeDates[0] ?? cutoffDate
  const periodEnd = inScopeDates[inScopeDates.length - 1] ?? cutoffDate

  const { data: upload, error: uploadErr } = await supabase
    .from('financials_uploads')
    .insert({
      filename: path.basename(filePath),
      period_start: periodStart,
      period_end: periodEnd,
      uploaded_by: 'Import Script',
      transaction_count: matched.length,
      matched_count: matchedCount,
      unmatched_count: unmatched.length,
    })
    .select()
    .single()
  if (uploadErr || !upload) {
    console.error('Failed to create financials_uploads record:', uploadErr)
    process.exit(1)
  }

  const rows = matched.map((t) => ({
    upload_id: upload.id,
    posted_date: t.postedDate,
    doc_number: t.docNumber,
    memo: t.memo,
    vendor_name: t.vendorName,
    class_name: t.className,
    gl_account_code: t.glAccountCode,
    gl_account_name: t.glAccountName,
    gl_category: t.glCategory,
    debit: t.debit,
    credit: t.credit,
    amount: t.amount,
    loan_number_ref: t.loanNumberRef,
    borrower_last_name_ref: t.borrowerLastNameRef,
    property_address_ref: t.propertyAddressRef,
    matched_closed_loan_id: t.matchedClosedLoanId,
    match_confidence: t.matchConfidence,
  }))

  const numBatches = Math.ceil(rows.length / BATCH_SIZE)
  for (let i = 0; i < numBatches; i++) {
    const batch = rows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
    console.log(`Inserting gl_transactions batch ${i + 1}/${numBatches}...`)
    const { error } = await supabase.from('gl_transactions').insert(batch)
    if (error) {
      console.error(`Batch ${i + 1} failed:`, error)
      process.exit(1)
    }
  }

  console.log(`\nDone. Upload id: ${upload.id}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
