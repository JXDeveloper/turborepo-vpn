import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return NextResponse.json(
      { message: "Error authenticating the user" },
      { status: 401 },
    );
  } else {
    console.log("i think it cannot authenticate request itself");
  }

  try {
    const payload = await request.json();

    console.log("-------- Webhook Payload Received--------");
    console.log(JSON.stringify(payload, null, 2));

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
