"use server"

import { generateSignature } from "@my-vpn/crypto-utils";

export default async function makeReq(): Promise<void> {
  const secret = process.env.BACKEND_API_SECRET;
  if(!secret) {
    throw new Error(`cannot load env variable`);
  }

  try {
    const res = await fetch("http://localhost:3000/api", {
      method: "POST",
      headers: {
        "Content-Type": "Application/json",  
        "Accept": "application/json",
      },
      body : JSON.stringify({
        signature: await generateSignature(secret, "hello world"),
        data: {
          str: "hello world",
        }
      }),
    });

    if (!res.ok) {
      console.log(res);
      throw new Error(`res was not good ${res.status}`);
    }

    const data = await res.json();

    console.log(data);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.log(error.message);
    }
  }
}
