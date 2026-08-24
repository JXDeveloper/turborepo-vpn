import { NextResponse } from "next/server";
import { signedApiRequest } from "@/lib/server/apiRequests";

const allowedOrigin = "http://localhost:5173";

export async function OPTIONS() {
  console.log("we received options request");
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigin,
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
      // response = await signedApiRequest("/peers", "POST", {
      //   publicKey: body.publicKey,
      // });
    } else {
      response = {
        error: "no publicKey specified",
      };
    }

    // Respond with a 200 OK status to acknowledge receipt of the webhook
    return NextResponse.json(
      { message: "Webhook received successfully", data: response },
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
