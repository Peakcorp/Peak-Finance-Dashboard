import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { withErrorHandling } from '@/lib/apiHandler'

export const PUT = withErrorHandling(async (req: NextRequest) => {
  const body = await req.json()
  const { month, notes } = body
  if (!month) return NextResponse.json({ error: 'Missing month' }, { status: 400 })

  const { data, error } = await supabaseServer
    .from('projection_month_notes')
    .upsert({ projection_month: month, notes: notes ?? null, updated_at: new Date().toISOString() }, { onConflict: 'projection_month' })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ note: data })
})
