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

    console.log('🔄 Proxying get canvas request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/canvas/${params.appId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    console.log('✅ Backend get canvas response status:', response.status)
    console.log('✅ Backend get canvas response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Get canvas proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

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

    console.log('🔄 Proxying save canvas request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/canvas/${params.appId}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    console.log('✅ Backend save canvas response status:', response.status)
    console.log('✅ Backend save canvas response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Save canvas proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    console.log('🔄 Proxying update canvas request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/canvas/${params.appId}`, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()
    
    console.log('✅ Backend update canvas response status:', response.status)
    console.log('✅ Backend update canvas response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Update canvas proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
