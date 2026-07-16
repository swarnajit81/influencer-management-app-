import { createHmac, timingSafeEqual } from "node:crypto";

export type TokenPayload = {
  kind: "package";
  campaignId: string;
  versionId: string;
  exp: number;
};

export type VerifyResult =
  | { ok: true; payload: TokenPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" | "no_secret" };

const DEFAULT_TTL_DAYS = 30;

function secret(): string | null {
  return process.env.TOKEN_SIGNING_SECRET ?? null;
}

function b64urlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(body: string, key: string): string {
  return b64urlEncode(createHmac("sha256", key).update(body).digest());
}

type UnsignedPayload = { kind: "package"; campaignId: string; versionId: string };

export function signToken(
  payload: UnsignedPayload,
  options?: { ttlDays?: number },
): string {
  const key = secret();
  if (!key) throw new Error("TOKEN_SIGNING_SECRET is not set");

  const exp =
    Math.floor(Date.now() / 1000) +
    (options?.ttlDays ?? DEFAULT_TTL_DAYS) * 24 * 60 * 60;

  const body = { ...payload, exp } as TokenPayload;
  const encoded = b64urlEncode(Buffer.from(JSON.stringify(body), "utf8"));
  const sig = sign(encoded, key);
  return `${encoded}.${sig}`;
}

export function verifyToken(token: string): VerifyResult {
  const key = secret();
  if (!key) return { ok: false, reason: "no_secret" };

  const parts = token.split(".");
  if (parts.length !== 2) return { ok: false, reason: "malformed" };
  const [encoded, providedSig] = parts;

  const expected = sign(encoded, key);
  const a = Buffer.from(expected);
  const b = Buffer.from(providedSig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "bad_signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(encoded).toString("utf8")) as TokenPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, payload };
}
