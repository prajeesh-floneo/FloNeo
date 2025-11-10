import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function POST(
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

    console.log('🔄 Proxying create element request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/canvas/${params.appId}/elements`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    console.log('✅ Backend create element response status:', response.status)
    console.log('✅ Backend create element response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Create element proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
