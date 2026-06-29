import { NextRequest, NextResponse } from 'next/server'

const GS_URL = process.env.NEXT_GS_URL ?? 'http://localhost:8600'

async function proxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params
  const url = `${GS_URL}/geoserver/${path.join('/')}${req.nextUrl.search}`

  const fwdHeaders = new Headers()
  const accept = req.headers.get('accept')
  if (accept) fwdHeaders.set('accept', accept)
  const contentType = req.headers.get('content-type')
  if (contentType) fwdHeaders.set('content-type', contentType)

  const body =
    req.method === 'GET' || req.method === 'HEAD'
      ? undefined
      : await req.arrayBuffer()

  const gs = await fetch(url, { method: req.method, headers: fwdHeaders, body })

  return new NextResponse(gs.body, {
    status: gs.status,
    headers: {
      'content-type': gs.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'no-store',
    },
  })
}

export const GET  = proxy
export const POST = proxy
