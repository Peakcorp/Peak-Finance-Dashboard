import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

function distinct(rows: { [key: string]: string | null }[] | null, col: string): string[] {
  if (!rows) return []
  const set = new Set<string>()
  for (const r of rows) {
    const v = r[col]
    if (v && v.trim()) set.add(v)
  }
  return Array.from(set).sort()
}

// Distinct filter-bar option lists, pooled across both closed and pipeline loans.
export const GET = withErrorHandling(async () => {
  const columns = [
    'loan_officer',
    'loan_processor',
    'property_state',
    'property_city',
    'loan_type',
    'loan_channel',
    'loan_program',
    'referral_source',
  ]

  const [closed, pipeline] = await Promise.all([
    fetchAllRows<{ [key: string]: string | null }>(() => supabaseServer.from('closed_loans').select(columns.join(',')) as any),
    fetchAllRows<{ [key: string]: string | null }>(() => supabaseServer.from('pipeline_loans').select(columns.join(',')) as any),
  ])
  if (closed.error) return NextResponse.json({ error: closed.error.message }, { status: 500 })
  if (pipeline.error) return NextResponse.json({ error: pipeline.error.message }, { status: 500 })

  const rows = [...closed.data, ...pipeline.data]

  return NextResponse.json({
    loanOfficers: distinct(rows, 'loan_officer'),
    processors: distinct(rows, 'loan_processor'),
    states: distinct(rows, 'property_state'),
    cities: distinct(rows, 'property_city'),
    loanTypes: distinct(rows, 'loan_type'),
    channels: distinct(rows, 'loan_channel'),
    loanPrograms: distinct(rows, 'loan_program'),
    referralSources: distinct(rows, 'referral_source'),
  })
})
