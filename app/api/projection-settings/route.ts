import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { withErrorHandling } from '@/lib/apiHandler'

export const GET = withErrorHandling(async () => {
  const { data, error } = await supabaseServer.from('projection_settings').select('*').order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ settings: data })
})

export const POST = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json()
  const { data, error } = await supabaseServer
    .from('projection_settings')
    .insert({
      name: body.name ?? 'New Rule Set',
      mode: body.mode ?? 'auto_milestone',
      included_milestones: body.included_milestones ?? [],
      confidence_by_milestone: body.confidence_by_milestone ?? {},
      include_past_est_date: body.include_past_est_date ?? true,
      include_no_est_date: body.include_no_est_date ?? false,
      weight_by_confidence: body.weight_by_confidence ?? true,
      description: body.description ?? null,
      is_active: false,
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data })
})

export const PATCH = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  if (fields.is_active === true) {
    await supabaseServer.from('projection_settings').update({ is_active: false }).neq('id', id)
  }

  const { data, error } = await supabaseServer
    .from('projection_settings')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data })
})

export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const { error } = await supabaseServer.from('projection_settings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
})
