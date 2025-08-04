import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/utils";

/**
 * Proxies EGI Check-in login requests to the OAuth endpoint to avoid CORS issues.
 * Accepts POST requests with x-www-form-urlencoded body.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const response = await fetch(
      `${getApiBaseUrl()}/oauth/realms/dev/protocol/openid-connect/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      }
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy error",
        details: error instanceof Error ? error.message : error,
      },
      { status: 500 }
    );
  }
}
