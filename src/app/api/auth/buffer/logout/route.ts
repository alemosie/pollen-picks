import { NextResponse } from "next/server";
import { HINT_COOKIE, LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/session";

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/", req.url));
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(HINT_COOKIE);
  res.cookies.delete(LEGACY_SESSION_COOKIE);
  return res;
}
