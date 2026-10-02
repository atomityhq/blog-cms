import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/login
 *
 * Mockup: accepts any well-formed email and non-empty password. With the backend
 * in place this forwards the credentials to POST {BACKEND_API_URL}/api/v1/auth/login
 * and stores the returned JWT in the same httpOnly cookie.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!EMAIL_PATTERN.test(email) || !password) {
    return NextResponse.json(
      { errors: [{ errorCode: "INVALID_CREDENTIALS", message: "Enter a valid email address and password." }] },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ data: { email } });
  response.cookies.set(SESSION_COOKIE, "mock-session", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
