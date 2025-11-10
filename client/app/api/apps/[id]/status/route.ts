import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    console.log('🔄 Proxying get app status request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}/status`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    console.log('✅ Backend get app status response status:', response.status)
    console.log('✅ Backend get app status response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Get app status proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    console.log('🔄 Proxying update app status request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}/status`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    console.log('✅ Backend update app status response status:', response.status)
    console.log('✅ Backend update app status response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Update app status proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
