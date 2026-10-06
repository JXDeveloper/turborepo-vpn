import { NextResponse } from "next/server";
import { signedApiRequest } from "@/lib/server/apiRequests";
import { getCorsAllowedOrigins } from "@/lib/server/env";

const allowedOrigins = getCorsAllowedOrigins();

/**
 * CORS headers for an incoming request: echo the caller's origin only
 * when it is in the allowlist (a response may carry a single origin,
 * never a list), and always vary caches on Origin.
 */
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  console.log("corsHeaders", headers);
  return headers;
}

export async function OPTIONS(request: Request) {
  console.log("we received options request");
  return new NextResponse(null, {
    status: 204,
    headers: {
      ...corsHeaders(request),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(request: Request) {
  try {
    console.log("request came in");
    const body = await request.json();

    let response = {};
    if (body.publicKey) {
      console.log(`public key: ${body.publicKey}`);
      response = await signedApiRequest("/peers", "POST", {
        publicKey: body.publicKey,
      });
    } else {
      response = {
        error: "no publicKey specified",
      };
    }

    // Respond with a 200 OK status to acknowledge receipt of the webhook
    return NextResponse.json(
      { message: "Webhook received successfully", configs: response },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
        },
      },
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { message: "Error processing webhook" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
        },
      },
    );
  }
}
