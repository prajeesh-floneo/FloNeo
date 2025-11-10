import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string; tableName: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page') || '1'
    const limit = searchParams.get('limit') || '50'

    console.log('🔄 Proxying get table data request to backend:', BACKEND_URL)
    console.log('📊 Table:', params.tableName, 'Page:', page, 'Limit:', limit)
    
    const response = await fetch(
      `${BACKEND_URL}/api/database/${params.appId}/tables/${params.tableName}/data?page=${page}&limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Backend table data request failed:', data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ Table data fetched successfully:', {
      appId: params.appId,
      tableName: params.tableName,
      rowCount: data.data?.length || 0,
      totalRows: data.pagination?.totalRows || 0
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error proxying table data request:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch table data' },
      { status: 500 }
    )
  }
}
