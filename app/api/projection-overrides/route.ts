import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { withErrorHandling } from '@/lib/apiHandler'

// Upserts a single manual-mode override: whether a pipeline loan counts toward a given month.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json()
  const { pipelineLoanId, projectionMonth, included, notes } = body
  if (!pipelineLoanId || !projectionMonth) {
    return NextResponse.json({ error: 'Missing pipelineLoanId or projectionMonth' }, { status: 400 })
  }

  const { data, error } = await supabaseServer
    .from('projection_overrides')
    .upsert(
      { pipeline_loan_id: pipelineLoanId, projection_month: projectionMonth, included: included ?? true, notes: notes ?? null },
      { onConflict: 'pipeline_loan_id,projection_month' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ override: data })
})

// Bulk "Include All" / "Clear Month" actions
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json()
  const { pipelineLoanIds, projectionMonth, included } = body as { pipelineLoanIds: string[]; projectionMonth: string; included: boolean }
  if (!Array.isArray(pipelineLoanIds) || !projectionMonth) {
    return NextResponse.json({ error: 'Missing pipelineLoanIds or projectionMonth' }, { status: 400 })
  }
  const rows = pipelineLoanIds.map((id) => ({ pipeline_loan_id: id, projection_month: projectionMonth, included }))
  const { error } = await supabaseServer.from('projection_overrides').upsert(rows, { onConflict: 'pipeline_loan_id,projection_month' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
