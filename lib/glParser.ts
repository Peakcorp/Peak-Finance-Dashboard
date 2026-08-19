import * as XLSX from 'xlsx'

export type GLCategory = 'revenue' | 'direct_expense' | 'overhead'

export interface ParsedGLTransaction {
  postedDate: string | null // YYYY-MM-DD
  docNumber: string | null
  memo: string | null
  vendorName: string | null
  className: string | null
  glAccountCode: string
  glAccountName: string
  glCategory: GLCategory
  debit: number | null
  credit: number | null
  amount: number
  loanNumberRef: string | null
  borrowerLastNameRef: string | null
  propertyAddressRef: string | null
}

export interface ParsedGLWorkbook {
  periodStart: string | null
  periodEnd: string | null
  transactions: ParsedGLTransaction[]
  accountSummary: { code: string; name: string; category: GLCategory; count: number }[]
}

const ACCOUNT_HEADER_RE = /^(\d{4}-\d{4})\s*-\s*(.+?)\s*\(Balance forward/i
const TOTALS_ROW_RE = /^Totals for\s/i

function categorize(code: string): GLCategory {
  if (code.startsWith('40') || code.startsWith('41') || code.startsWith('42') || code.startsWith('70')) return 'revenue'
  if (code.startsWith('50') || code.startsWith('51')) return 'direct_expense'
  return 'overhead'
}

function toDateString(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

function toNumber(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

export function extractLoanRef(memo: string | null): {
  loanNumber: string | null
  borrowerLastName: string | null
  propertyAddress: string | null
} {
  if (!memo) return { loanNumber: null, borrowerLastName: null, propertyAddress: null }

  let loanNumber: string | null = null
  let borrowerLastName: string | null = null
  let propertyAddress: string | null = null

  const loanMatch = memo.match(/Loan\s*#\s*(\d+)(?:\s*:\s*([A-Za-z][A-Za-z'-]*))?/i)
  if (loanMatch) {
    loanNumber = loanMatch[1]
    if (loanMatch[2]) borrowerLastName = loanMatch[2]
  }

  const addressMatch = memo.match(/^(.*?)\s*\((?:Funding|Purchase)/i)
  if (addressMatch && addressMatch[1] && addressMatch[1].length > 5) {
    propertyAddress = addressMatch[1].trim()
  }

  const brokerMatch = memo.match(/Broker Funding:\s*([A-Za-z][A-Za-z'-]*)?\s*\(([^)]+)\)/i)
  if (brokerMatch) {
    if (!borrowerLastName && brokerMatch[1]) borrowerLastName = brokerMatch[1]
    if (!propertyAddress && brokerMatch[2]) propertyAddress = brokerMatch[2].trim()
  }

  return { loanNumber, borrowerLastName, propertyAddress }
}

// Original raw export: account-header rows ("4010-0005 - Name (Balance forward As of ...)")
// interleaved with transaction rows and "Totals for ..." footer rows, 13 columns wide.
function parseRawFormat(rows: unknown[][]): ParsedGLWorkbook {
  let periodStart: string | null = null
  let periodEnd: string | null = null
  for (const row of rows.slice(0, 7)) {
    if (row[0] === 'Start Date:') periodStart = toDateString(row[1])
    if (row[0] === 'End Date:') periodEnd = toDateString(row[1])
  }

  const transactions: ParsedGLTransaction[] = []
  const accountCounts = new Map<string, { name: string; category: GLCategory; count: number }>()

  let currentCode: string | null = null
  let currentName: string | null = null
  let currentCategory: GLCategory = 'overhead'

  for (let i = 7; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === null || c === undefined)) continue

    const first = row[0]
    if (typeof first === 'string') {
      const headerMatch = first.match(ACCOUNT_HEADER_RE)
      if (headerMatch) {
        currentCode = headerMatch[1]
        currentName = headerMatch[2]
        currentCategory = categorize(currentCode)
        if (!accountCounts.has(currentCode)) accountCounts.set(currentCode, { name: currentName, category: currentCategory, count: 0 })
        continue
      }
      if (TOTALS_ROW_RE.test(first)) continue
    }

    if (!currentCode || !currentName) continue // stray row before first account header

    const memo = (row[3] as string | null) ?? null
    const debit = toNumber(row[10])
    const credit = toNumber(row[11])
    const amount = currentCategory === 'revenue' ? (credit ?? 0) - (debit ?? 0) : (debit ?? 0) - (credit ?? 0)
    const { loanNumber, borrowerLastName, propertyAddress } = extractLoanRef(memo)

    transactions.push({
      postedDate: toDateString(row[0]),
      docNumber: (row[2] as string | null) ?? null,
      memo,
      vendorName: (row[5] as string | null) ?? null,
      className: (row[6] as string | null) ?? null,
      glAccountCode: currentCode,
      glAccountName: currentName,
      glCategory: currentCategory,
      debit,
      credit,
      amount,
      loanNumberRef: loanNumber,
      borrowerLastNameRef: borrowerLastName,
      propertyAddressRef: propertyAddress,
    })
    accountCounts.get(currentCode)!.count++
  }

  const accountSummary = Array.from(accountCounts.entries()).map(([code, v]) => ({
    code,
    name: v.name,
    category: v.category,
    count: v.count,
  }))

  return { periodStart, periodEnd, transactions, accountSummary }
}

// Pre-cleaned export: a flat "Transactions" sheet, one row per transaction, no header/totals
// rows to skip — columns: Account, GL Code, Posted Date, Doc Date, Memo/Description, Debit, Credit.
function parseFlatFormat(rows: unknown[][]): ParsedGLWorkbook {
  const transactions: ParsedGLTransaction[] = []
  const accountCounts = new Map<string, { name: string; category: GLCategory; count: number }>()
  let minDate: string | null = null
  let maxDate: string | null = null

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((c) => c === null || c === undefined)) continue

    const name = (row[0] as string | null) ?? null
    const code = (row[1] as string | null) ?? null
    if (!code || !name) continue

    const category = categorize(code)
    if (!accountCounts.has(code)) accountCounts.set(code, { name, category, count: 0 })

    const postedDate = toDateString(row[2])
    const memo = (row[4] as string | null) ?? null
    const debit = toNumber(row[5])
    const credit = toNumber(row[6])
    const amount = category === 'revenue' ? (credit ?? 0) - (debit ?? 0) : (debit ?? 0) - (credit ?? 0)
    const { loanNumber, borrowerLastName, propertyAddress } = extractLoanRef(memo)

    if (postedDate) {
      if (!minDate || postedDate < minDate) minDate = postedDate
      if (!maxDate || postedDate > maxDate) maxDate = postedDate
    }

    transactions.push({
      postedDate,
      docNumber: null,
      memo,
      vendorName: null,
      className: null,
      glAccountCode: code,
      glAccountName: name,
      glCategory: category,
      debit,
      credit,
      amount,
      loanNumberRef: loanNumber,
      borrowerLastNameRef: borrowerLastName,
      propertyAddressRef: propertyAddress,
    })
    accountCounts.get(code)!.count++
  }

  const accountSummary = Array.from(accountCounts.entries()).map(([code, v]) => ({
    code,
    name: v.name,
    category: v.category,
    count: v.count,
  }))

  return { periodStart: minDate, periodEnd: maxDate, transactions, accountSummary }
}

const FLAT_HEADER = ['Account', 'GL Code', 'Posted Date', 'Doc Date', 'Memo/Description', 'Debit', 'Credit']

export function parseGLWorkbook(buffer: Buffer): ParsedGLWorkbook {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const flatSheetName = wb.SheetNames.find((n) => n === 'Transactions')
  if (flatSheetName) {
    const ws = wb.Sheets[flatSheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const header = (rows[0] ?? []).map((c) => (typeof c === 'string' ? c.trim() : c))
    const looksFlat = FLAT_HEADER.every((h, i) => header[i] === h)
    if (looksFlat) return parseFlatFormat(rows)
  }

  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
  return parseRawFormat(rows)
}
