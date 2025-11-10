import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

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

    const body = await request.json()

    console.log('🔄 Proxying workflow execution request to backend:', BACKEND_URL)
    console.log('🚀 [WF-EXEC-PROXY] Request body:', {
      appId: body.appId,
      workflowId: body.workflowId,
      nodesCount: body.nodes?.length,
      contextKeys: Object.keys(body.context || {})
    })
    
    const response = await fetch(`${BACKEND_URL}/api/workflow/execute`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('❌ [WF-EXEC-PROXY] Backend execution failed:', data)
      return NextResponse.json(data, { status: response.status })
    }

    console.log('✅ [WF-EXEC-PROXY] Workflow execution successful:', {
      success: data.success,
      resultsCount: data.results?.length,
      message: data.message
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error('❌ [WF-EXEC-PROXY] Error proxying workflow execution request:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to execute workflow' },
      { status: 500 }
    )
  }
}
