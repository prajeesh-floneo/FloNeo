import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Cache control headers to prevent caching
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string; tableName: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401, headers: NO_CACHE_HEADERS }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '50'
    // Add timestamp to backend URL to prevent caching
    const timestamp = Date.now()

    console.log('🔄 Proxying get table data request to backend:', BACKEND_URL)
    console.log('📊 Table:', params.tableName, 'Page:', page, 'Limit:', limit)
    
    const response = await fetch(
      `${BACKEND_URL}/api/database/${params.appId}/tables/${params.tableName}/data?page=${page}&limit=${limit}&_t=${timestamp}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
        cache: 'no-store', // Prevent Next.js from caching the fetch
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Backend table data request failed:', data)
      return NextResponse.json(data, { 
        status: response.status,
        headers: NO_CACHE_HEADERS
      })
    }

    console.log('✅ Table data fetched successfully:', {
      appId: params.appId,
      tableName: params.tableName,
      rowCount: data.data?.length || 0,
      totalRows: data.pagination?.totalRows || 0
    })

    return NextResponse.json(data, { headers: NO_CACHE_HEADERS })
  } catch (error) {
    console.error('❌ Error proxying table data request:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch table data' },
      { status: 500, headers: NO_CACHE_HEADERS }
    )
  }
}
