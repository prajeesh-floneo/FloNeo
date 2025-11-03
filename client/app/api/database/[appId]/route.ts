import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    console.log('🔄 Proxying get user tables request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/database/${params.appId}/tables`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Backend database request failed:', data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ Database tables fetched successfully:', {
      appId: params.appId,
      tablesCount: data.tables?.length || 0
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error proxying database request:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch database tables' },
      { status: 500 }
    )
  }
}
