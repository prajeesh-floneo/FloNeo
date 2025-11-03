import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function PATCH(
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

    const body = await request.json()

    console.log('🔄 Proxying save canvas state request to backend:', BACKEND_URL)
    console.log('📦 Canvas state data:', JSON.stringify(body, null, 2))
    
    const response = await fetch(`${BACKEND_URL}/api/canvas/${params.appId}/state`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Backend canvas state save failed:', data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ Canvas state saved successfully via proxy')
    return NextResponse.json(data)

  } catch (error) {
    console.error('❌ Canvas state proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
