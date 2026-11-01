"use client";

import { useState } from "react";

type Channel = { id: string; name: string; service: string };

export function DraftPanel({ channels, picks, initialCaption }: { channels: Channel[]; picks: number[]; initialCaption: string }) {
  const [channelId, setChannelId] = useState(channels.find((c) => c.service === "instagram")?.id ?? channels[0]?.id ?? "");
  const [caption, setCaption] = useState(initialCaption);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function create() {
    setState("busy");
    setMsg("");
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, service: channels.find((c) => c.id === channelId)?.service, picks, caption }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string; slides?: number };
      if (!res.ok) throw new Error(res.status === 401 ? "Your Buffer session expired. Reload this page to reconnect." : (j.error ?? `HTTP ${res.status}`));
      setState("done");
      setMsg(`Draft created with ${j.slides} slides.`);
    } catch (e) {
      setState("error");
      setMsg(e instanceof Error ? e.message : String(e));
    }
  }

  if (channels.length === 0) return <p className="mt-10 font-semibold">No Buffer channels found on this account. Connect one in Buffer first.</p>;

  return (
    <section className="mt-12 grid max-w-2xl gap-4 rounded-2xl bg-card p-6">
      <h2 className="text-2xl">Send to Buffer</h2>
      <label className="grid gap-1 text-sm font-semibold">
        Channel
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)} className="rounded-xl bg-surface px-3 py-2 font-normal ring-1 ring-ink/15">
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.service} · {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm font-semibold">
        Caption
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={10} className="rounded-xl bg-surface px-3 py-2 font-normal ring-1 ring-ink/15" />
      </label>
      <div className="flex items-center gap-4">
        <button onClick={create} disabled={state === "busy" || !channelId} className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep disabled:opacity-60">
          {state === "busy" ? "Creating draft…" : "Create draft in Buffer"}
        </button>
        <span className="text-sm text-ink/70">Saved as a draft. Nothing is published.</span>
      </div>
      {msg && (
        <p role="status" className={state === "error" ? "rounded-xl bg-surface p-3 font-semibold ring-2 ring-coral" : "font-semibold"}>
          {msg}{" "}
          {state === "done" && (
            <a href="https://publish.buffer.com" target="_blank" rel="noreferrer" className="underline underline-offset-4">
              Open Buffer
            </a>
          )}
        </p>
      )}
    </section>
  );
}
