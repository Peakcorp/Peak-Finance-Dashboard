import * as XLSX from 'xlsx'

export type GLCategory = 'revenue' | 'direct_expense' | 'overhead'

export type Branch = 'Woodland Hills' | 'Las Vegas' | 'Corporate'

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
  locationCode: string | null
  branch: Branch | null
  msaLoanOfficer: string | null
}

export interface ParsedGLWorkbook {
  periodStart: string | null
  periodEnd: string | null
  transactions: ParsedGLTransaction[]
  accountSummary: { code: string; name: string; category: GLCategory; count: number }[]
}

const ACCOUNT_HEADER_RE = /^(\d{4}-\d{4})\s*-\s*(.+?)\s*\(Balance forward/i
const TOTALS_ROW_RE = /^Totals for\s/i

// Recurring rent/marketing bills tied to a loan officer's own branded MSA entity — these
// reference no specific loan, so they can't be caught by the loan-matching logic below.
// Confirmed with the business: "Our Legacy Corporation" is Alma's, "P16:3 Inc" is Luana's.
const MSA_VENDOR_TO_LOAN_OFFICER: Record<string, string> = {
  'Our Legacy Corporation': 'Alma Pulido',
  'P16:3 Inc': 'Luana Gerardis',
}

// 10201/10202 are the two real branches; 102 is the parent entity (Bridgelock Capital) and is
// treated as an unallocated corporate cost, not split between branches.
function branchFromLocation(code: string | null): Branch | null {
  if (code === '10201') return 'Woodland Hills'
  if (code === '10202') return 'Las Vegas'
  if (code === '102') return 'Corporate'
  return null
}

function categorize(code: string): GLCategory {
  if (code.startsWith('40') || code.startsWith('41') || code.startsWith('42') || code.startsWith('70')) return 'revenue'
  if (code.startsWith('50') || code.startsWith('51')) return 'direct_expense'
  return 'overhead'
}

// Handles a real Date (from an .xlsx date cell read with cellDates:true), a raw Excel serial
// number (date cell read without cellDates — used for CSVs, see parseGLWorkbook), or a plain
// date string like "01/02/2019" (from CSV text).
function toDateString(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    return value.toISOString().split('T')[0]
  }
  if (typeof value === 'number') {
    const d = XLSX.SSF.parse_date_code(value)
    if (d && d.y > 1900) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    return null
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0]
  }
  return null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) {
    const n = parseFloat(value.replace(/,/g, ''))
    return isNaN(n) ? null : n
  }
  return null
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
    const vendorName = (row[5] as string | null) ?? null

    transactions.push({
      postedDate: toDateString(row[0]),
      docNumber: (row[2] as string | null) ?? null,
      memo,
      vendorName,
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
      locationCode: null,
      branch: null,
      msaLoanOfficer: MSA_VENDOR_TO_LOAN_OFFICER[vendorName ?? ''] ?? null,
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
      locationCode: null,
      branch: null,
      msaLoanOfficer: null,
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

// Branch-aware export: named columns (order-independent), one row per transaction —
// GL Account, GL Name, Posted dt., Doc dt., Doc, Memo/Description, Department name,
// Vendor name, Class name, Class, Department, Location name, Location, ...
interface NamedRow {
  [key: string]: unknown
  'GL Account'?: unknown
  'GL Name'?: unknown
  'Posted dt.'?: unknown
  Doc?: unknown
  'Memo/Description'?: unknown
  'Vendor name'?: unknown
  'Class name'?: unknown
  Location?: unknown
  Debit?: unknown
  Credit?: unknown
}

function parseNamedCSVFormat(rows: NamedRow[]): ParsedGLWorkbook {
  const transactions: ParsedGLTransaction[] = []
  const accountCounts = new Map<string, { name: string; category: GLCategory; count: number }>()
  let minDate: string | null = null
  let maxDate: string | null = null

  for (const row of rows) {
    const code = (row['GL Account'] as string | null) ?? null
    const name = (row['GL Name'] as string | null) ?? null
    if (!code || !name) continue

    const category = categorize(code)
    if (!accountCounts.has(code)) accountCounts.set(code, { name, category, count: 0 })

    const postedDate = toDateString(row['Posted dt.'])
    const memo = (row['Memo/Description'] as string | null) ?? null
    const debit = toNumber(row['Debit'])
    const credit = toNumber(row['Credit'])
    const amount = category === 'revenue' ? (credit ?? 0) - (debit ?? 0) : (debit ?? 0) - (credit ?? 0)
    const { loanNumber, borrowerLastName, propertyAddress } = extractLoanRef(memo)
    const vendorName = (row['Vendor name'] as string | null) ?? null
    const locationCode = row['Location'] !== null && row['Location'] !== undefined ? String(row['Location']) : null

    if (postedDate) {
      if (!minDate || postedDate < minDate) minDate = postedDate
      if (!maxDate || postedDate > maxDate) maxDate = postedDate
    }

    transactions.push({
      postedDate,
      docNumber: (row['Doc'] as string | null) ?? null,
      memo,
      vendorName,
      className: (row['Class name'] as string | null) ?? null,
      glAccountCode: code,
      glAccountName: name,
      glCategory: category,
      debit,
      credit,
      amount,
      loanNumberRef: loanNumber,
      borrowerLastNameRef: borrowerLastName,
      propertyAddressRef: propertyAddress,
      locationCode,
      branch: branchFromLocation(locationCode),
      msaLoanOfficer: MSA_VENDOR_TO_LOAN_OFFICER[vendorName ?? ''] ?? null,
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
const NAMED_CSV_REQUIRED_COLUMNS = ['GL Account', 'GL Name', 'Posted dt.', 'Location']

export function parseGLWorkbook(buffer: Buffer): ParsedGLWorkbook {
  // raw:true + cellDates:false everywhere: with cellDates on, SheetJS's CSV type-sniffing can
  // misread a code like "5000-0005" as a date in some rows, silently corrupting GL account
  // codes. toDateString() above handles a real Date, a raw Excel serial, or a date string, so
  // we lose nothing by always reading raw and parsing dates ourselves.
  const wb = XLSX.read(buffer, { type: 'buffer', raw: true, cellDates: false })

  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  const firstRowObjects = XLSX.utils.sheet_to_json<NamedRow>(firstSheet, { defval: null })
  if (firstRowObjects.length && NAMED_CSV_REQUIRED_COLUMNS.every((c) => c in firstRowObjects[0])) {
    return parseNamedCSVFormat(firstRowObjects)
  }

  const flatSheetName = wb.SheetNames.find((n) => n === 'Transactions')
  if (flatSheetName) {
    const ws = wb.Sheets[flatSheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
    const header = (rows[0] ?? []).map((c) => (typeof c === 'string' ? c.trim() : c))
    const looksFlat = FLAT_HEADER.every((h, i) => header[i] === h)
    if (looksFlat) return parseFlatFormat(rows)
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: null })
  return parseRawFormat(rows)
}
