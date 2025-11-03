import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "No authorization header" },
        { status: 401 }
      );
    }

    console.log("🔄 Proxying get app request to backend:", BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}`, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("✅ Backend get app response status:", response.status);
    console.log("✅ Backend get app response success:", data.success);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Get app proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "No authorization header" },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.log("🔄 Proxying update app request to backend:", BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}`, {
      method: "PUT",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log("✅ Backend update app response status:", response.status);
    console.log("✅ Backend update app response success:", data.success);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Update app proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "No authorization header" },
        { status: 401 }
      );
    }

    const body = await request.json();

    console.log("🔄 Proxying patch app request to backend:", BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}`, {
      method: "PATCH",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    console.log("✅ Backend patch app response status:", response.status);
    console.log("✅ Backend patch app response success:", data.success);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Patch app proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "No authorization header" },
        { status: 401 }
      );
    }

    console.log("🔄 Proxying delete app request to backend:", BACKEND_URL);

    const response = await fetch(`${BACKEND_URL}/api/apps/${params.id}`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    console.log("✅ Backend delete app response status:", response.status);
    console.log("✅ Backend delete app response success:", data.success);

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("❌ Delete app proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
