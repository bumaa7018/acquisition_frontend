// Docker сүлжээнд: NEXT_API_URL=http://api:8080, NEXT_GS_URL=http://geoserver:8080
// Локал хөгжүүлэлтэд:  NEXT_API_URL=http://localhost:8080, NEXT_GS_URL=http://localhost:8600
const API_URL = process.env.NEXT_API_URL ?? 'http://localhost:8080'
const GS_URL  = process.env.NEXT_GS_URL  ?? 'http://localhost:8600'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone зөвхөн production-д хэрэгтэй, dev-д disc идэх тул хасав
  ...(process.env.NODE_ENV === 'production' && { output: 'standalone' }),
  async rewrites() {
    return [
      { source: '/api/v1/:path*',    destination: `${API_URL}/api/v1/:path*` },
      { source: '/geoserver/:path*', destination: `${GS_URL}/geoserver/:path*` },
    ]
  },
}
export default nextConfig
