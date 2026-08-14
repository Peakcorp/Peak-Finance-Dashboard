import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { searchParamsToFilters, applyCommonFilters } from '@/lib/filterUtils'
import { todayISO } from '@/lib/dataUtils'
import {
  getProjectionMonths,
  computeAutoProjections,
  computeManualProjections,
  computeLOProjectionBreakdown,
  computeActualsVsProjected,
} from '@/lib/projectionUtils'
import type { ClosedLoan, PipelineLoan, ProjectionOverride, ProjectionSettings, ProjectionMonthNote } from '@/lib/types'
import { withErrorHandling } from '@/lib/apiHandler'
import { fetchAllRows } from '@/lib/fetchAllRows'

export const GET = withErrorHandling(async (req: NextRequest) => {
  const filters = searchParamsToFilters(req.nextUrl.searchParams)

  const { data: activeSetting, error: settingErr } = await supabaseServer
    .from('projection_settings')
    .select('*')
    .eq('is_active', true)
    .maybeSingle()
  if (settingErr) return NextResponse.json({ error: settingErr.message }, { status: 500 })
  if (!activeSetting) return NextResponse.json({ error: 'No active projection rule set found.' }, { status: 400 })
  const settings = activeSetting as ProjectionSettings

  const { data: pipeline, error: pipelineErr } = await fetchAllRows<PipelineLoan>(() => {
    let q = supabaseServer.from('pipeline_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })
  if (pipelineErr) return NextResponse.json({ error: pipelineErr.message }, { status: 500 })

  const { data: closed } = await fetchAllRows<ClosedLoan>(() => {
    let q = supabaseServer.from('closed_loans').select('*')
    q = applyCommonFilters(q as any, filters) as any
    return q as any
  })

  const months = getProjectionMonths(4)

  let overrides: ProjectionOverride[] = []
  if (settings.mode === 'manual') {
    const { data: overrideData } = await supabaseServer.from('projection_overrides').select('*').in('projection_month', months)
    overrides = (overrideData ?? []) as ProjectionOverride[]
  }

  const monthProjections =
    settings.mode === 'auto_milestone'
      ? computeAutoProjections(pipeline, settings, months, todayISO())
      : computeManualProjections(pipeline, overrides, months)

  const loBreakdown = computeLOProjectionBreakdown(pipeline, monthProjections, months)
  const actualsVsProjected = computeActualsVsProjected(closed, monthProjections, 6, 4)

  const { data: notesData } = await supabaseServer.from('projection_month_notes').select('*').in('projection_month', months)
  const monthNotes = (notesData ?? []) as ProjectionMonthNote[]

  return NextResponse.json({
    settings,
    months: months.map((m) => monthProjections[m]),
    loBreakdown,
    actualsVsProjected,
    monthNotes,
    pipelineLoans: settings.mode === 'manual' ? pipeline : [],
    overrides,
  })
})
