import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
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
    const category = searchParams.get('category') || ''

    console.log('🔄 Proxying templates request to backend:', BACKEND_URL)
    
    const response = await fetch(`${BACKEND_URL}/api/templates${category ? `?category=${category}` : ''}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    console.log('✅ Backend templates response status:', response.status)
    console.log('✅ Backend templates response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Templates proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
