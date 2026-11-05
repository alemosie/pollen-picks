import { NextRequest, NextResponse } from "next/server";
import { FAKE_BEHAVIOURS, readFakeSettings, resetFakeSettings, writeFakeSettings, type FakeSettings } from "@/lib/fake";

// Development only: the /dev page reads and saves fake-mode settings here. In production this answers 404 and touches nothing.
const off = () => new NextResponse(null, { status: 404 });
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  if (process.env.NODE_ENV === "production") return off();
  return NextResponse.json({ settings: readFakeSettings(), env: { fake: process.env.BUFFER_FAKE === "1", channels: Number(process.env.BUFFER_FAKE_CHANNELS) || 0 } }, { headers: NO_STORE });
}

/** Body: a partial FakeSettings (merged into what is saved), or `{ reset: true }` to go back to the env vars. */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return off();
  const body = (await req.json().catch(() => ({}))) as Partial<FakeSettings> & { reset?: boolean };
  if (body.reset) {
    resetFakeSettings();
    return NextResponse.json({ settings: readFakeSettings() }, { headers: NO_STORE });
  }
  const cur = readFakeSettings();
  const next: FakeSettings = { ...cur };
  if (typeof body.enabled === "boolean") next.enabled = body.enabled;
  if (body.channels !== undefined) next.channels = Number(body.channels);
  if (body.rateLimitNext !== undefined) next.rateLimitNext = Number(body.rateLimitNext);
  if (body.behaviour && typeof body.behaviour === "object") {
    const merged = { ...cur.behaviour };
    for (const [k, v] of Object.entries(body.behaviour)) {
      if (v === "pass") delete merged[k];
      else if ((FAKE_BEHAVIOURS as readonly unknown[]).includes(v)) merged[k] = v;
    }
    next.behaviour = merged;
  }
  writeFakeSettings(next);
  // Read back through the same cleaning as every other reader, so what the page shows is what the app will use.
  return NextResponse.json({ settings: readFakeSettings() }, { headers: NO_STORE });
}
