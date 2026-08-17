import { NextResponse } from "next/server";
import { signedApiRequest } from "@/lib/server/apiRequests";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    await signedApiRequest("/peers", "POST", {
      publicKey: body.publicKey,
    });

    // Respond with a 200 OK status to acknowledge receipt of the webhook
    return NextResponse.json(
      { message: "Webhook received successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { message: "Error processing webhook" },
      { status: 500 },
    );
  }
}
