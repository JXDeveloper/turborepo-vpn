import { stripeClient } from "@/stripe";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const charges = await stripeClient.customers.retrieve("cus_VBrlM49vw09iS0");
  return NextResponse.json(
    { message: "Webhook received successfully", charges: charges },
    // {
    //   status: 200,
    //   headers: {
    //     "Access-Control-Allow-Origin": "allowedOrigin",
    //   },
    // },
  );
}
