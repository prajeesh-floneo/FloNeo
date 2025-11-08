import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache control headers to prevent caching
const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function DELETE(
  request: NextRequest,
  { params }: { params: { appId: string; tableName: string } }
) {
  try {
    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      return NextResponse.json(
        { success: false, message: "No authorization header" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    console.log("🔄 Proxying delete table request to backend:", BACKEND_URL);

    const response = await fetch(
      `${BACKEND_URL}/api/database/${params.appId}/tables/${params.tableName}`,
      {
        method: "DELETE",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Backend delete table request failed:", data);
      return NextResponse.json(data, {
        status: response.status,
        headers: NO_CACHE_HEADERS,
      });
    }

    console.log("✅ Table deleted successfully:", params.tableName);
    return NextResponse.json(data, { headers: NO_CACHE_HEADERS });
  } catch (error: any) {
    console.error("❌ Error in delete table API route:", error);
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
