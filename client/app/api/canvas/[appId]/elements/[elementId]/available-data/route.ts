import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { appId: string; elementId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    console.log('🔄 Proxying available-data request to backend:', BACKEND_URL)
    
    const response = await fetch(
      `${BACKEND_URL}/api/canvas/${params.appId}/elements/${params.elementId}/available-data`,
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
      return NextResponse.json(data, { status: response.status })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Error proxying available-data request:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch available data' },
      { status: 500 }
    )
  }
}

