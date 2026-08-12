export async function getHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function generateSignature(
  secret: string,
  message: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await getHmacKey(secret);

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );

  // Convert ArrayBuffer to Hex string
  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifySignature(
  secret: string,
  message: string,
  signatureHex: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await getHmacKey(secret);

  // Convert Hex string back to Uint8Array Buffer
  const signatureBytes = new Uint8Array(
    signatureHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || [],
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(message),
  );
}

export type Keypair = {
  publicKey: string;
  privateKey: string;
};

async function generateX25519KeypairViaWebCrypto(): Promise<Keypair> {
  const base64UrlToBase64 = (value: string) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  };

  const keyPair = (await globalThis.crypto.subtle.generateKey(
    { name: "X25519" },
    true,
    ["deriveBits"],
  )) as CryptoKeyPair;

  if (!("publicKey" in keyPair) || !("privateKey" in keyPair)) {
    throw new Error("Web Crypto did not return an X25519 keypair");
  }

  const publicKeyJwk = await globalThis.crypto.subtle.exportKey(
    "jwk",
    keyPair.publicKey,
  );
  const privateKeyJwk = await globalThis.crypto.subtle.exportKey(
    "jwk",
    keyPair.privateKey,
  );

  if (typeof publicKeyJwk.x !== "string" || typeof privateKeyJwk.d !== "string") {
    throw new Error("Web Crypto did not export an X25519 JWK keypair");
  }

  return {
    publicKey: base64UrlToBase64(publicKeyJwk.x),
    privateKey: base64UrlToBase64(privateKeyJwk.d),
  };
}

async function generateX25519KeypairViaNode(): Promise<Keypair> {
  type X25519Jwk = JsonWebKey & { x?: string; d?: string };
  type GenerateX25519Keypair = (
    type: "x25519",
    options: {
      publicKeyEncoding: { format: "jwk" };
      privateKeyEncoding: { format: "jwk" };
    },
  ) => { publicKey: X25519Jwk; privateKey: X25519Jwk };

  const base64UrlToBase64 = (value: string) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    return base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  };

  const importNodeCrypto = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("node:crypto")>;
  const nodeCrypto = await importNodeCrypto("node:crypto");
  const generateKeyPairSync =
    nodeCrypto.generateKeyPairSync as unknown as GenerateX25519Keypair;
  const { publicKey, privateKey } = generateKeyPairSync("x25519", {
    publicKeyEncoding: { format: "jwk" },
    privateKeyEncoding: { format: "jwk" },
  });

  if (typeof publicKey.x !== "string" || typeof privateKey.d !== "string") {
    throw new Error("Node crypto did not export an X25519 JWK keypair");
  }

  return {
    publicKey: base64UrlToBase64(publicKey.x),
    privateKey: base64UrlToBase64(privateKey.d),
  };
}

export async function genKeypair(): Promise<Keypair> {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined"
  ) {
    try {
      return await generateX25519KeypairViaWebCrypto();
    } catch {
      // fall through to Node fallback if Web Crypto can't generate X25519
    }
  }

  if (
    typeof process !== "undefined" &&
    typeof process.versions?.node === "string"
  ) {
    return await generateX25519KeypairViaNode();
  }

  throw new Error("Unable to generate X25519 keypair in this runtime");
}
