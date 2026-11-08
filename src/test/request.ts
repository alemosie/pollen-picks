// Test-only. Runs a route handler the way Next does: inside a request scope, so `cookies()` and `after()` work, and the tasks handed to
// `after()` are collected instead of run in the background (a test runs them, or checks they were queued, when it wants).

import { NextRequest } from "next/server";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { RequestCookies } from "next/dist/compiled/@edge-runtime/cookies";
import { SESSION_COOKIE, seal } from "../lib/session";

export type Task = () => unknown;

/** A request, signed in as `uid` unless `uid` is null. */
export function makeRequest(url: string, o: { method?: string; uid?: string | null; body?: unknown; headers?: Record<string, string>; cookies?: Record<string, string> } = {}): NextRequest {
  const cookies: Record<string, string> = { ...(o.cookies ?? {}) };
  if (o.uid) cookies[SESSION_COOKIE] = seal({ uid: o.uid });
  const headers = new Headers(o.headers ?? {});
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (cookieHeader) headers.set("cookie", cookieHeader);
  const hasBody = o.body !== undefined;
  if (hasBody) headers.set("content-type", "application/json");
  return new NextRequest(url, { method: o.method ?? (hasBody ? "POST" : "GET"), headers, body: hasBody ? (typeof o.body === "string" ? o.body : JSON.stringify(o.body)) : undefined });
}

export async function inRequest<T>(req: NextRequest, run: () => Promise<T>): Promise<{ value: T; afterTasks: Task[] }> {
  const afterTasks: Task[] = [];
  const cookies = new RequestCookies(req.headers);
  const workStore = { route: "/test", afterContext: { after: (t: Task) => void afterTasks.push(t) }, isStaticGeneration: false, forceDynamic: false } as never;
  const unit = { type: "request", phase: "action", cookies, userspaceMutableCookies: cookies, headers: req.headers, url: { pathname: "/test", search: "" } } as never;
  const value = await workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(unit, run));
  return { value, afterTasks };
}
