"use node";

import { createHash, randomBytes } from "crypto";

interface DigestParams {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
}

function md5(data: string): string {
  return createHash("md5").update(data).digest("hex");
}

function parseWWWAuthenticate(header: string): DigestParams {
  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;
  while ((match = regex.exec(header)) !== null) {
    params[match[1]] = match[2];
  }
  return {
    realm: params.realm ?? "",
    nonce: params.nonce ?? "",
    qop: params.qop,
    opaque: params.opaque,
  };
}

export interface DigestFetchResult {
  status: number;
  body: string;
}

export type DigestBody = string | Uint8Array | null;

export async function digestFetch(
  url: string,
  method: string,
  body: DigestBody,
  username: string,
  password: string,
  contentType: string = "application/json",
): Promise<DigestFetchResult> {
  const headers: Record<string, string> = { "Content-Type": contentType };

  const requestBody = method !== "GET" && body !== null ? body : undefined;
  // Uint8Array node-fetch tarafından kabul ediliyor; TS lib bunu BodyInit'e dahil etmediği için cast.
  const fetchBody = requestBody as BodyInit | undefined;

  const firstResponse = await fetch(url, {
    method,
    headers,
    body: fetchBody,
  });

  if (firstResponse.status !== 401) {
    return { status: firstResponse.status, body: await firstResponse.text() };
  }

  const wwwAuth = firstResponse.headers.get("www-authenticate");
  if (!wwwAuth) {
    return { status: 401, body: "WWW-Authenticate header bulunamadı" };
  }

  const dp = parseWWWAuthenticate(wwwAuth);
  const parsed = new URL(url);
  const uri = parsed.pathname + parsed.search;
  const cnonce = randomBytes(8).toString("hex");
  const nc = "00000001";
  const ha1 = md5(`${username}:${dp.realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = dp.qop
    ? md5(`${ha1}:${dp.nonce}:${nc}:${cnonce}:auth:${ha2}`)
    : md5(`${ha1}:${dp.nonce}:${ha2}`);

  let authHeader = `Digest username="${username}", realm="${dp.realm}", nonce="${dp.nonce}", uri="${uri}", response="${response}"`;
  if (dp.qop) authHeader += `, qop=auth, nc=${nc}, cnonce="${cnonce}"`;
  if (dp.opaque) authHeader += `, opaque="${dp.opaque}"`;

  const secondResponse = await fetch(url, {
    method,
    headers: { ...headers, Authorization: authHeader },
    body: fetchBody,
  });

  return { status: secondResponse.status, body: await secondResponse.text() };
}
