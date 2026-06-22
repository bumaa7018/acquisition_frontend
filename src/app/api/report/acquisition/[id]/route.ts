import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

export const runtime = 'nodejs'

const BACKEND = process.env.NEXT_API_URL ?? 'http://localhost:8080'

const RIGHT_TYPE_LABELS: Record<number, string> = {
  1: 'Ашиглах',
  2: 'Эзэмших',
  3: 'Өмчлөх',
}

async function backendFetch(url: string, token: string) {
  const res = await fetch(`${BACKEND}${url}`, {
    headers: { Authorization: token },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`Backend ${url} → ${res.status}`)
  return res.json()
}

type AnyRow = any

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const token = request.headers.get('authorization') ?? ''

  try {
    // 1. Бүх мэдээллийг зэрэг татах
    const [acqRes, compsRes, assetsRes] = await Promise.all([
      backendFetch(`/api/v1/land-acquisitions/${id}`, token),
      backendFetch(`/api/v1/land-acquisitions/${id}/compensations`, token),
      backendFetch(`/api/v1/land-acquisitions/${id}/assets?page=1&page_size=1000`, token),
    ])

    const acq: AnyRow             = acqRes.data
    const compensations: AnyRow[] = compsRes.data ?? []
    const assets: AnyRow[]        = assetsRes.data ?? []
    const parcels: AnyRow[]       = acq.parcels ?? []

    // 2. Нэгж талбар бүрийн эзэмшигчийн мэдээлэл татах
    const parcelDetailResults = await Promise.all(
      parcels.map((p: AnyRow) =>
        backendFetch(`/api/v1/land-acquisitions/${id}/parcels/${p.id}`, token).catch(() => null)
      )
    )

    // 3. Загвар файлыг уншах (dynamic import — Turbopack-тай нийцтэй)
    const ExcelJS = (await import('exceljs')).default
    const templatePath = path.join(process.cwd(), 'public', 'templates', 'report_template.xlsx')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(templatePath)
    const ws = workbook.getWorksheet(1)!

    // 4. Загварын 5-р мөрийн style хадгалах
    const templateDataRow = ws.getRow(5)
    const savedStyles: AnyRow[] = []
    for (let c = 1; c <= 19; c++) {
      savedStyles.push(JSON.parse(JSON.stringify(templateDataRow.getCell(c).style)))
    }
    const savedRowHeight = templateDataRow.height ?? 18

    // template-д хэдэн дата мөр байгааг тодорхойлох (5-р мөрөөс хойш)
    const lastTemplateRowNum = ws.lastRow?.number ?? 5

    // 5. НЗД-ын захирамжийн мэдээлэл
    const decreePart = [acq.decree_date ?? '', acq.decree_number ?? ''].filter(Boolean).join(' ')

    // 6. Мөр бүрийн утгыг бэлтгэх
    const allRowValues: (string | number | null)[][] = parcels.map((p: AnyRow, idx: number) => {
      const detail: AnyRow = parcelDetailResults[idx]?.data?.detail ?? null

      const parcelComps  = compensations.filter((c: AnyRow) => c.parcel_id === p.parcel_id)
      const parcelAssets = assets.filter((a: AnyRow) => a.parcel_id === p.parcel_id)
      const realStateIds = new Set<string>(
        parcelAssets.filter((a: AnyRow) => a.asset_type === 'real_state').map((a: AnyRow) => a.id as string)
      )
      const propIds = new Set<string>(
        parcelAssets.filter((a: AnyRow) => a.asset_type === 'property').map((a: AnyRow) => a.id as string)
      )

      const landValue     = parcelComps.filter((c: AnyRow) => c.target_type === 'parcel')
        .reduce((s: number, c: AnyRow) => s + (c.amount ?? 0), 0)
      const realStateComp = parcelComps.filter((c: AnyRow) => c.target_type === 'asset' && c.asset_id && realStateIds.has(c.asset_id))
        .reduce((s: number, c: AnyRow) => s + (c.amount ?? 0), 0)
      const propComp      = parcelComps.filter((c: AnyRow) => c.target_type === 'asset' && c.asset_id && propIds.has(c.asset_id))
        .reduce((s: number, c: AnyRow) => s + (c.amount ?? 0), 0)
      const totalComp     = landValue + realStateComp + propComp

      const remaining = p.remaining_area_m2 != null
        ? p.remaining_area_m2
        : ((p.area_m2 ?? 0) - (p.acquisition_area_m2 ?? 0))

      const holderName = detail ? `${detail.holder_last_name ?? ''} ${detail.holder_name ?? ''}`.trim() : ''
      const holderReg  = detail?.holder_register_no ?? ''
      const holderFull = [holderName, holderReg].filter(Boolean).join(', ')

      return [
        null,                                               // A (1)
        idx + 1,                                           // B №
        acq.construction_type_name || '',                  // C
        acq.acquisition_name || '',                        // D
        decreePart,                                        // E
        holderFull,                                        // F
        '',                                                // G Хаяг
        p.parcel_id ?? '',                                 // H
        p.area_m2 ?? 0,                                    // I
        RIGHT_TYPE_LABELS[p.right_type as number] ?? '',   // J
        p.acquisition_area_m2 ?? 0,                        // K
        landValue     > 0 ? landValue     : null,          // L
        realStateComp > 0 ? realStateComp : null,          // M
        propComp      > 0 ? propComp      : null,          // N
        totalComp     > 0 ? totalComp     : null,          // O
        remaining     > 0 ? remaining     : null,          // P
        p.db_changed ? 'Тийм' : 'Үгүй',                   // Q
        p.changed_parcel_id || '',                         // R
        remaining     > 0 ? remaining     : null,          // S
      ]
    })

    // 7. Template-ийн дата мөрүүдийг (5-р мөрөөс хойш) шинэ өгөгдлөөр дарж бичих
    for (let idx = 0; idx < allRowValues.length; idx++) {
      const rowNum   = 5 + idx
      const rowVals  = allRowValues[idx]
      const row      = ws.getRow(rowNum)
      row.height     = savedRowHeight

      for (let c = 1; c <= 19; c++) {
        const cell = row.getCell(c)
        cell.style = JSON.parse(JSON.stringify(savedStyles[c - 1]))
        cell.value = rowVals[c - 1] ?? null
      }
      row.commit()
    }

    // 8. Үлдсэн template дата мөрүүдийг цэвэрлэх
    for (let r = 5 + allRowValues.length; r <= lastTemplateRowNum; r++) {
      const row = ws.getRow(r)
      for (let c = 1; c <= 19; c++) {
        row.getCell(c).value = null
      }
      row.commit()
    }

    // 9. Excel binary буцаах
    const buffer = await workbook.xlsx.writeBuffer()
    const safeName = (acq.acquisition_name || id).replace(/[/\\?%*:|"<>]/g, '_')

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`2010_тайлан_${safeName}`)}.xlsx`,
      },
    })
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Тайлан үүсгэхэд алдаа гарлаа' }, { status: 500 })
  }
}
