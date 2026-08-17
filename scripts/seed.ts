/**
 * One-time seeder: reads scripts/data/encompass.xlsx and loads it into Supabase.
 * Run with: npm run seed
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dotenv = require('dotenv')
dotenv.config({ path: '.env.local' })

import path from 'path'
import * as XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import { parseClosedLoanRow, parseLoanRow, isStalePipelineRow, STALE_PIPELINE_CUTOFF_DATE, type RawEncompassRow } from '../lib/dataUtils'

const BATCH_SIZE = 100

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }
  const supabase = createClient(url, serviceRoleKey)

  const filePath = path.join(__dirname, 'data', 'encompass.xlsx')
  console.log(`Reading ${filePath}...`)
  const wb = XLSX.readFile(filePath, { cellDates: true })

  const dataSheet = wb.Sheets['Data']
  const tableSheet = wb.Sheets['Table']
  if (!dataSheet && !tableSheet) {
    console.error('Neither "Data" nor "Table" sheet found in workbook.')
    process.exit(1)
  }

  const uploadRow = {
    filename: path.basename(filePath),
    sheet_type: dataSheet && tableSheet ? 'both' : dataSheet ? 'closed' : 'pipeline',
    uploaded_by: 'Seed Script',
  }
  const { data: upload, error: uploadErr } = await supabase
    .from('uploads')
    .insert(uploadRow)
    .select()
    .single()
  if (uploadErr || !upload) {
    console.error('Failed to create upload record:', uploadErr)
    process.exit(1)
  }

  let closedTotal = 0
  let closedNew = 0
  let closedSkipped = 0
  let pipelineCount = 0

  // ---------- Closed loans (Data sheet) ----------
  if (dataSheet) {
    const rawRows = XLSX.utils.sheet_to_json<RawEncompassRow>(dataSheet, { defval: null })
    const closedRows = rawRows
      .map((r) => parseClosedLoanRow(r))
      .filter((r) => r.isClosed) // only rows that reached the Completion milestone are real closed loans

    closedTotal = closedRows.length
    console.log(`Data sheet: ${rawRows.length} total rows, ${closedTotal} reached Completion and will be seeded as closed loans.`)

    const numBatches = Math.ceil(closedRows.length / BATCH_SIZE)
    for (let i = 0; i < numBatches; i++) {
      const batch = closedRows
        .slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        .map(({ isClosed, ...r }) => ({ ...r, upload_id: upload.id }))
      console.log(`Inserting closed-loan batch ${i + 1}/${numBatches}...`)
      const { data: inserted, error } = await supabase
        .from('closed_loans')
        .upsert(batch, { onConflict: 'unique_key', ignoreDuplicates: true })
        .select('id')
      if (error) {
        console.error(`Batch ${i + 1} failed:`, error)
        continue
      }
      const newCount = inserted?.length ?? 0
      closedNew += newCount
      closedSkipped += batch.length - newCount
    }
  }

  // ---------- Pipeline loans (Table sheet) — full replace ----------
  if (tableSheet) {
    const { error: deleteErr } = await supabase.from('pipeline_loans').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteErr) {
      console.error('Failed to clear existing pipeline_loans:', deleteErr)
    }

    const rawRows = XLSX.utils.sheet_to_json<RawEncompassRow>(tableSheet, { defval: null })
    const parsedRows = rawRows.map((r) => parseLoanRow(r))
    const staleCount = parsedRows.filter((r) => isStalePipelineRow(r)).length
    const pipelineRows = parsedRows.filter((r) => !isStalePipelineRow(r)).map((r) => ({ ...r, upload_id: upload.id }))
    pipelineCount = pipelineRows.length
    console.log(`Table sheet: ${rawRows.length} total rows, ${staleCount} excluded as stale (non-Completion, started before ${STALE_PIPELINE_CUTOFF_DATE}), ${pipelineCount} will be seeded as pipeline.`)

    const numBatches = Math.ceil(pipelineRows.length / BATCH_SIZE)
    for (let i = 0; i < numBatches; i++) {
      const batch = pipelineRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      console.log(`Inserting pipeline batch ${i + 1}/${numBatches}...`)
      const { error } = await supabase.from('pipeline_loans').insert(batch)
      if (error) console.error(`Pipeline batch ${i + 1} failed:`, error)
    }
  }

  await supabase
    .from('uploads')
    .update({ closed_count: closedNew, pipeline_count: pipelineCount })
    .eq('id', upload.id)

  console.log(
    `Done: ${formatCount(closedTotal)} closed loans (${formatCount(closedNew)} new, ${formatCount(closedSkipped)} skipped). ${formatCount(pipelineCount)} pipeline loans.`,
  )
}

function formatCount(n: number): string {
  return n.toLocaleString('en-US')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
