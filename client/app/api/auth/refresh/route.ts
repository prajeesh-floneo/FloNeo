import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    console.log('🔄 Proxying token refresh request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ Backend token refresh failed:', data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ Token refreshed successfully')
    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ Token refresh proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to refresh token' },
      { status: 500 }
    )
  }
}

