export async function getHmacKey(secret: string): Promise<CryptoKey> {

  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256"},
    false,
    ['sign', 'verify']
  );
}

export async function generateSignature(secret: string, message: string) : Promise<string> {
  const encoder = new TextEncoder();
  const key = await getHmacKey(secret);
  
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message)
  );

  // Convert ArrayBuffer to Hex string
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySignature(secret: string, message: string, signatureHex: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await getHmacKey(secret);

  // Convert Hex string back to Uint8Array Buffer
  const signatureBytes = new Uint8Array(
    signatureHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(message)
  );
}
