import type { FastifyReply, FastifyRequest } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export interface SessionClaims {
  userId: string;
  walletAddress?: string;
  tier: string;
  scopes: string[];
  iat: number;
  exp: number;
}

export function createSessionToken(input: {
  userId: string;
  walletAddress?: string;
  tier?: string | null;
  scopes?: string[] | null;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const claims: SessionClaims = {
    userId: input.userId,
    walletAddress: input.walletAddress,
    tier: input.tier ?? "free",
    scopes: input.scopes ?? ["scan:read", "user:write"],
    iat: now,
    exp: now + env.sessionTtlSeconds,
  };

  const payload = base64UrlEncode(JSON.stringify(claims));
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function readSession(request: FastifyRequest): SessionClaims | null {
  const token = getCookie(request, env.sessionCookieName);
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const claims = JSON.parse(base64UrlDecode(payload)) as SessionClaims;
    if (!claims.userId || !claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

export function setSessionCookie(reply: FastifyReply, token: string): void {
  reply.header("Set-Cookie", serializeCookie(env.sessionCookieName, token, {
    maxAge: env.sessionTtlSeconds,
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? "None" : "Lax",
    path: "/",
  }));
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header("Set-Cookie", serializeCookie(env.sessionCookieName, "", {
    maxAge: 0,
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSecure ? "None" : "Lax",
    path: "/",
  }));
}

function getCookie(request: FastifyRequest, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (!cookie) return undefined;

  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }

  return undefined;
}

function serializeCookie(
  name: string,
  value: string,
  options: { maxAge: number; httpOnly: boolean; secure: boolean; sameSite: "Lax" | "None"; path: string }
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path}`,
    `SameSite=${options.sameSite}`,
  ];

  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function sign(payload: string): string {
  return createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}
