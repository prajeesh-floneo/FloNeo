import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = (() => {
  if (typeof globalThis === "undefined") return "http://backend:5000";
  const raw = (globalThis as any)?.process?.env?.BACKEND_URL;
  if (typeof raw === "string" && raw.trim()) {
    return raw.replace(/\/$/, "");
  }
  return "http://backend:5000";
})();

export const dynamic = "force-dynamic";

const PASSTHROUGH_HEADERS = [
  "range",
  "if-modified-since",
  "if-none-match",
  "if-range",
  "authorization",
  "accept",
];

const buildForwardHeaders = (request: NextRequest): Headers => {
  const headers = new Headers();

  PASSTHROUGH_HEADERS.forEach((header) => {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  return headers;
};

const proxyMediaAsset = async (
  request: NextRequest,
  targetUrl: string
): Promise<NextResponse> => {
  const backendResponse = await fetch(targetUrl, {
    method: "GET",
    headers: buildForwardHeaders(request),
    redirect: "manual",
  });

  if (!backendResponse.ok && backendResponse.status !== 206) {
    const errorText = await backendResponse.text();
    return new NextResponse(errorText, {
      status: backendResponse.status,
      headers: backendResponse.headers,
    });
  }

  const headers = new Headers();
  backendResponse.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  if (!headers.has("cache-control")) {
    headers.set("cache-control", "public, max-age=60");
  }

  return new NextResponse(backendResponse.body, {
    status: backendResponse.status,
    headers,
  });
};

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
): Promise<NextResponse> {
  const { filename } = params;

  if (!filename) {
    return NextResponse.json(
      { success: false, message: "Filename is required" },
      { status: 400 }
    );
  }

  try {
    const encoded = encodeURIComponent(filename);
    const targetUrl = `${BACKEND_URL}/api/media/files/${encoded}`;
    return await proxyMediaAsset(request, targetUrl);
  } catch (error) {
    console.error("❌ Media file proxy error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch media file" },
      { status: 502 }
    );
  }
}
