import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/buffer";
import { SESSION_COOKIE } from "@/lib/session";

export async function GET() {
  const res = NextResponse.redirect(siteUrl("/"));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
