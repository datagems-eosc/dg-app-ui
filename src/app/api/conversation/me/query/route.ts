import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/utils";

/**
 * Proxies chat history queries to the external API, forwarding the Authorization header and request body.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }
    const body = await req.text();
    const url = `${getApiBaseUrl()}/gw/api/conversation/me/query`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body,
    });

    if (response.status === 401) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication token is invalid or expired",
        },
        { status: 401 }
      );
    }

    let data;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Proxy error",
          details: {
            status: response.status,
            statusText: response.statusText,
            message: "Failed to parse JSON response from upstream API.",
            responseText: text,
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Proxy error",
        details:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      },
      { status: 500 }
    );
  }
}
