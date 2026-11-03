import { NextRequest, NextResponse } from "next/server";
import {
  DEMO_HL_COOKIE,
  DEMO_HL_PARAM,
  decodeDemoRows,
  encodeDemoRows,
} from "@/lib/pollen/demoHighlights";

// A demo share link can carry the sharer's highlights as `hl=`. Keep them in this visitor's cookie (re-encoded from what
// validated, so nothing unchecked is stored) and send them on to the same address without the parameter.
export function proxy(req: NextRequest) {
  const hl = req.nextUrl.searchParams.get(DEMO_HL_PARAM);
  if (hl === null) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.searchParams.delete(DEMO_HL_PARAM);
  const res = NextResponse.redirect(url);
  const rows = decodeDemoRows(hl);
  if (rows.length > 0)
    res.cookies.set({
      name: DEMO_HL_COOKIE,
      value: encodeDemoRows(rows),
      path: "/",
      maxAge: 86400,
      sameSite: "lax",
    });
  return res;
}

export const config = { matcher: "/demo/:path*" };
