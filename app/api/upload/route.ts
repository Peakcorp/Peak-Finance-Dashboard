import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { supabaseServer } from '@/lib/supabase-server'
import { parseClosedLoanRow, parseLoanRow, isStalePipelineRow, type RawEncompassRow } from '@/lib/dataUtils'
import type { UploadApiResponse } from '@/lib/types'
import { withErrorHandling } from '@/lib/apiHandler'

const BATCH_SIZE = 100

export const POST = withErrorHandling(async (req: NextRequest) => {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const uploadedBy = (formData.get('uploadedBy') as string | null)?.trim() || 'Unknown'

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true })

  const dataSheet = wb.Sheets['Data']
  const tableSheet = wb.Sheets['Table']

  if (!dataSheet && !tableSheet) {
    return NextResponse.json(
      { error: 'No recognized sheets found. Expected a "Data" sheet (closed loans) and/or a "Table" sheet (pipeline).' },
      { status: 400 },
    )
  }

  const sheetType = dataSheet && tableSheet ? 'both' : dataSheet ? 'closed' : 'pipeline'

  const { data: upload, error: uploadErr } = await supabaseServer
    .from('uploads')
    .insert({ filename: file.name, sheet_type: sheetType, uploaded_by: uploadedBy })
    .select()
    .single()

  if (uploadErr || !upload) {
    return NextResponse.json({ error: uploadErr?.message ?? 'Failed to record upload' }, { status: 500 })
  }

  let closedTotal = 0
  let closedNew = 0
  let closedSkipped = 0
  let pipelineCount = 0

  if (dataSheet) {
    const rawRows = XLSX.utils.sheet_to_json<RawEncompassRow>(dataSheet, { defval: null })
    const closedRows = rawRows
      .map((r) => parseClosedLoanRow(r))
      .filter((r) => r.isClosed)

    closedTotal = closedRows.length
    const numBatches = Math.ceil(closedRows.length / BATCH_SIZE)
    for (let i = 0; i < numBatches; i++) {
      const batch = closedRows
        .slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
        .map(({ isClosed, ...r }) => ({ ...r, upload_id: upload.id }))
      const { data: inserted, error } = await supabaseServer
        .from('closed_loans')
        .upsert(batch, { onConflict: 'unique_key', ignoreDuplicates: true })
        .select('id')
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const newCount = inserted?.length ?? 0
      closedNew += newCount
      closedSkipped += batch.length - newCount
    }
  }

  if (tableSheet) {
    const { error: deleteErr } = await supabaseServer
      .from('pipeline_loans')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
    if (deleteErr) {
      return NextResponse.json({ error: deleteErr.message }, { status: 500 })
    }

    const rawRows = XLSX.utils.sheet_to_json<RawEncompassRow>(tableSheet, { defval: null })
    const pipelineRows = rawRows
      .map((r) => parseLoanRow(r))
      .filter((r) => !isStalePipelineRow(r))
      .map((r) => ({ ...r, upload_id: upload.id }))
    pipelineCount = pipelineRows.length

    const numBatches = Math.ceil(pipelineRows.length / BATCH_SIZE)
    for (let i = 0; i < numBatches; i++) {
      const batch = pipelineRows.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const { error } = await supabaseServer.from('pipeline_loans').insert(batch)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }
  }

  await supabaseServer
    .from('uploads')
    .update({ closed_count: closedNew, pipeline_count: pipelineCount })
    .eq('id', upload.id)

  const response: UploadApiResponse = {
    closedTotal,
    closedNew,
    closedSkipped,
    pipelineCount,
    uploadId: upload.id,
  }
  return NextResponse.json(response)
})
