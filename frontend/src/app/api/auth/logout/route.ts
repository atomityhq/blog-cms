import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session";

/** POST /api/auth/logout — clears the session cookie. */
export async function POST() {
  const response = NextResponse.json({ data: null });
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
