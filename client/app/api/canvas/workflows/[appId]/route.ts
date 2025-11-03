import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const { searchParams } = new URL(request.url);
  const elementId = searchParams.get("elementId") || "";
  const preview = searchParams.get("preview") || "";
  const token =
    request.headers.get("authorization")?.replace("Bearer ", "") || "";

  console.log(
    "📡 PROXY: Forwarding GET to backend for appId:",
    appId,
    "elementId:",
    elementId,
    "preview:",
    preview
  );

  try {
    // FIXED: Use correct backend endpoint /api/canvas/workflows/:appId
    const backendUrl = elementId
      ? `http://backend:5000/api/canvas/workflows/${appId}?elementId=${encodeURIComponent(
          elementId
        )}${preview ? "&preview=true" : ""}`
      : `http://backend:5000/api/canvas/workflows/${appId}${
          preview ? "?preview=true" : ""
        }`;

    console.log("📡 PROXY: Backend URL:", backendUrl);

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error("❌ PROXY: Backend returned status:", response.status);
      const errorText = await response.text();
      console.error("❌ PROXY: Backend error:", errorText);
      return NextResponse.json(
        { success: false, message: "Backend error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ PROXY: Successfully fetched from backend, data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ PROXY: Backend fetch error:", error);
    return NextResponse.json(
      { success: false, message: "Backend fetch failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ appId: string }> }
) {
  const { appId } = await params;
  const token =
    request.headers.get("authorization")?.replace("Bearer ", "") || "";
  const body = await request.json();

  console.log("📡 PROXY: Forwarding PATCH to backend for appId:", appId);
  console.log("📡 PROXY: Request body:", body);

  try {
    const response = await fetch(
      `http://backend:5000/api/canvas/workflows/${appId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      console.error(
        "❌ PROXY: Backend PATCH returned status:",
        response.status
      );
      const errorText = await response.text();
      console.error("❌ PROXY: Backend PATCH error:", errorText);
      return NextResponse.json(
        { success: false, message: "Backend patch error" },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("✅ PROXY: Successfully patched to backend, data:", data);
    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ PROXY: Backend patch error:", error);
    return NextResponse.json(
      { success: false, message: "Backend patch failed" },
      { status: 500 }
    );
  }
}
