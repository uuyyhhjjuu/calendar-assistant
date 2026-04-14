import { randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "calendar_session";
const ISSUER = "calendar-assistant";
const EXP_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export function createSlug() {
  return randomBytes(12).toString("base64url");
}

export async function signSessionToken(payload: { calendarId: string; slug: string }) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setExpirationTime(`${EXP_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify(token, getSecret(), { issuer: ISSUER });
  return result.payload as { calendarId: string; slug: string };
}

export function getCookieConfig() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: EXP_SECONDS,
    },
  };
}