import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: 'No authorization header' },
        { status: 401 }
      )
    }

    // Get the form data from the request
    const formData = await request.formData()

    console.log('🔄 Proxying media upload request to backend:', BACKEND_URL)
    
    // Forward the form data to the backend
    const response = await fetch(`${BACKEND_URL}/api/media/upload`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        // Don't set Content-Type header - let fetch set it with boundary for multipart/form-data
      },
      body: formData,
    })

    const data = await response.json()
    
    console.log('✅ Backend media upload response status:', response.status)
    console.log('✅ Backend media upload response success:', data.success)

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('❌ Media upload proxy error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
