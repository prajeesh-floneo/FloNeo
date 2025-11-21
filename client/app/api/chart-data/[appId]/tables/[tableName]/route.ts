import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(
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

    const { searchParams } = new URL(request.url);
    const xKey = searchParams.get("xKey") || "";
    const yKey = searchParams.get("yKey") || "";
    const chartType = searchParams.get("chartType") || "chart-line";
    const limit = searchParams.get("limit") || "500";
    const timestamp = Date.now();

    const backendUrl = `${BACKEND_URL}/api/chart-data/${params.appId}/tables/${params.tableName}?xKey=${encodeURIComponent(
      xKey
    )}&yKey=${encodeURIComponent(yKey)}&chartType=${encodeURIComponent(
      chartType
    )}&limit=${encodeURIComponent(limit)}&_t=${timestamp}`;

    const response = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
      cache: "no-store",
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Backend chart data request failed:", data);
      return NextResponse.json(data, {
        status: response.status,
        headers: NO_CACHE_HEADERS,
      });
    }

    return NextResponse.json(data, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error("❌ Error proxying chart data request:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch chart data" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
