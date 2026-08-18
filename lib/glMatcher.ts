import type { ParsedGLTransaction } from './glParser'
import type { ClosedLoan } from './types'

export type MatchConfidence = 'high' | 'medium' | 'low'

export interface MatchedGLTransaction extends ParsedGLTransaction {
  matchedClosedLoanId: string | null
  matchConfidence: MatchConfidence | null
}

function normalizeName(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().trim().replace(/[^a-z']/g, '')
}

function streetPart(address: string): string {
  return address.split(',')[0].trim()
}

function normalizeStreet(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
}

function daysBetween(a: string, b: string): number {
  return Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86400000)
}

// Loans very likely to close relative to a GL posting within this window are preferred
// when a borrower surname matches more than one loan.
const DATE_PROXIMITY_DAYS = 180

export function matchTransactionsToLoans(
  transactions: ParsedGLTransaction[],
  closedLoans: ClosedLoan[],
): MatchedGLTransaction[] {
  const byLastName = new Map<string, ClosedLoan[]>()
  for (const loan of closedLoans) {
    const key = normalizeName(loan.borrower_last_name)
    if (!key) continue
    if (!byLastName.has(key)) byLastName.set(key, [])
    byLastName.get(key)!.push(loan)
  }

  return transactions.map((tx): MatchedGLTransaction => {
    const nameKey = normalizeName(tx.borrowerLastNameRef)
    const candidates = nameKey ? byLastName.get(nameKey) ?? [] : []
    const txStreet = tx.propertyAddressRef ? normalizeStreet(streetPart(tx.propertyAddressRef)) : ''

    if (candidates.length === 1) {
      return { ...tx, matchedClosedLoanId: candidates[0].id, matchConfidence: 'high' }
    }

    if (candidates.length > 1) {
      // Narrow by street address first (same surname can recur across siblings/repeat borrowers)
      let pool = candidates
      let narrowedByAddress = false
      if (txStreet) {
        const addressMatches = candidates.filter((c) => {
          const candidateStreet = normalizeStreet(c.property_address)
          return candidateStreet && (candidateStreet === txStreet || candidateStreet.includes(txStreet) || txStreet.includes(candidateStreet))
        })
        if (addressMatches.length >= 1) {
          pool = addressMatches
          narrowedByAddress = true
        }
      }

      if (pool.length === 1) {
        return { ...tx, matchedClosedLoanId: pool[0].id, matchConfidence: 'high' }
      }

      // Same address can recur across years (refinance) — break the remaining tie by
      // closest completion date to the GL posting date, within the already-narrowed pool.
      if (tx.postedDate) {
        const withDates = pool
          .filter((c) => c.milestone_date_completion)
          .map((c) => ({ loan: c, dist: daysBetween(tx.postedDate!, c.milestone_date_completion!) }))
          .filter((c) => c.dist <= DATE_PROXIMITY_DAYS)
          .sort((a, b) => a.dist - b.dist)
        if (withDates.length >= 1 && (withDates.length === 1 || withDates[0].dist < withDates[1].dist)) {
          return { ...tx, matchedClosedLoanId: withDates[0].loan.id, matchConfidence: narrowedByAddress ? 'high' : 'medium' }
        }
      }
      // Ambiguous — pick nothing rather than guess wrong
      return { ...tx, matchedClosedLoanId: null, matchConfidence: null }
    }

    // No name-based candidate — try address-only matching across all loans
    if (txStreet) {
      const addressOnlyMatches = closedLoans.filter((c) => {
        const candidateStreet = normalizeStreet(c.property_address)
        return candidateStreet && (candidateStreet === txStreet || candidateStreet.includes(txStreet) || txStreet.includes(candidateStreet))
      })
      if (addressOnlyMatches.length === 1) {
        return { ...tx, matchedClosedLoanId: addressOnlyMatches[0].id, matchConfidence: 'medium' }
      }
    }

    return { ...tx, matchedClosedLoanId: null, matchConfidence: null }
  })
}
