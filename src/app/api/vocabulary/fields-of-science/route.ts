import { NextRequest, NextResponse } from "next/server";
import { getApiBaseUrl } from "@/lib/utils";

/**
 * Proxies fields-of-science vocabulary requests to the external API.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing Authorization header" },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${getApiBaseUrl()}/gw/api/vocabulary/fields-of-science`,
      {
        method: "GET",
        headers: {
          Authorization: authHeader,
        },
      }
    );

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
