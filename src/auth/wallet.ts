import bs58 from "bs58";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import type { AppConfig } from "../config/env";
import type { AuthChallenge } from "../types/domain";

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function encodeU32LE(n: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n, true);
  return b;
}

/** Short_vec-style length prefix (common in Solana layouts). */
function encodeShortVecLen(n: number): Uint8Array {
  const bytes: number[] = [];
  let rem = n;
  for (;;) {
    const part = rem & 0x7f;
    rem >>= 7;
    if (rem === 0) {
      bytes.push(part);
      break;
    }
    bytes.push(part | 0x80);
  }
  return new Uint8Array(bytes);
}

/**
 * Candidate payloads wallets may sign for signMessage(challengeBytes).
 * Phantom / Solana wallets often wrap UTF-8 in an off-chain message framing.
 */
function signingPayloadCandidates(messageUtf8: Uint8Array): Uint8Array[] {
  const header = new TextEncoder().encode("Solana Signed Message:\n");
  const ff = Uint8Array.of(0xff);
  const u32 = encodeU32LE(messageUtf8.length);
  const sv = encodeShortVecLen(messageUtf8.length);
  const list: Uint8Array[] = [
    messageUtf8,
    concatBytes(ff, header, u32, messageUtf8),
    concatBytes(ff, header, sv, messageUtf8),
    concatBytes(header, u32, messageUtf8),
    concatBytes(header, sv, messageUtf8),
  ];
  const seen = new Set<string>();
  const out: Uint8Array[] = [];
  for (const p of list) {
    const key = Buffer.from(p).toString("base64");
    if (!seen.has(key)) {
      seen.add(key);
      out.push(p);
    }
  }
  return out;
}

function detachedVerify(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): boolean {
  try {
    return signature.length === 64 && nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

export function verifyWalletSignature(params: {
  wallet: string;
  message: string;
  signatureBase58: string;
  challenge: AuthChallenge;
}): boolean {
  const { wallet, message, signatureBase58, challenge } = params;
  if (wallet !== challenge.wallet) return false;
  if (Date.now() > challenge.expiresAt) return false;
  if (message.trim() !== challenge.message.trim()) return false;

  try {
    const pk = new PublicKey(wallet).toBytes();
    const sig = bs58.decode(signatureBase58);
    if (sig.length !== 64) return false;

    const utf8 = new TextEncoder().encode(message);
    for (const payload of signingPayloadCandidates(utf8)) {
      if (detachedVerify(sig, payload, pk)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function signSessionJwt(wallet: string, cfg: AppConfig): string {
  const opts = { expiresIn: cfg.JWT_EXPIRES_IN } as SignOptions;
  return jwt.sign({ sub: wallet, typ: "wallet" }, cfg.JWT_SECRET, opts);
}

export function verifySessionJwt(token: string, cfg: AppConfig): { wallet: string } | null {
  try {
    const p = jwt.verify(token, cfg.JWT_SECRET) as JwtPayload;
    const w = typeof p.sub === "string" ? p.sub : null;
    if (!w) return null;
    new PublicKey(w); // validate base58
    return { wallet: w };
  } catch {
    return null;
  }
}
