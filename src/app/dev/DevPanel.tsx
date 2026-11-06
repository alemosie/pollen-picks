"use client";

import { useCallback, useEffect, useState } from "react";

type Behaviour = "pass" | "fail" | "unknown" | "publish_fail";
type Settings = { enabled?: boolean; channels?: number; behaviour?: Record<string, Behaviour>; rateLimitNext?: number; enforceLimits?: boolean };

const NETWORKS: [string, string][] = [
  ["instagram", "Instagram"],
  ["linkedin", "LinkedIn"],
  ["facebook", "Facebook"],
  ["threads", "Threads"],
  ["bluesky", "Bluesky"],
  ["twitter", "X (Twitter)"],
  ["mastodon", "Mastodon"],
  ["tiktok", "TikTok"],
  ["pinterest", "Pinterest"],
];
const BEHAVIOURS: [Behaviour, string][] = [
  ["pass", "Works"],
  ["fail", "Buffer rejects it (Failed)"],
  ["unknown", "Request dies (Unknown, publish now only)"],
  ["publish_fail", "Accepted, then can't publish (publish now only)"],
];
const CHANNEL_PRESETS = [0, 3, 5, 10, 20, 60];

const FIELD = "rounded-xl bg-surface px-3 py-2 text-sm font-semibold ring-1 ring-ink/15 hover:ring-ink/40";
const BUTTON = "rounded-xl bg-surface px-4 py-2 text-sm font-bold ring-1 ring-ink/15 hover:ring-ink/40 disabled:opacity-60";

export function DevPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [env, setEnv] = useState({ fake: false, channels: 0, limits: false });
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/dev/fake", { cache: "no-store" });
    if (!r.ok) return setNote("The dev API isn't available (production build?).");
    const j = (await r.json()) as { settings: Settings; env: { fake: boolean; channels: number; limits: boolean } };
    setSettings(j.settings);
    setEnv(j.env);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const save = async (patch: Settings & { reset?: boolean }) => {
    setNote("");
    const r = await fetch("/api/dev/fake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!r.ok) return setNote("Couldn't save.");
    setSettings(((await r.json()) as { settings: Settings }).settings);
  };

  if (!settings) return <p className="m-0 text-sm font-semibold">{note || "Loading…"}</p>;

  const enabled = settings.enabled ?? env.fake;
  const channels = settings.channels ?? env.channels;
  const enforceLimits = settings.enforceLimits ?? env.limits;

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-2xl bg-card p-5">
        <label className="flex items-center gap-3 font-bold">
          <input type="checkbox" checked={enabled} onChange={(e) => void save({ enabled: e.target.checked })} className="size-5" />
          Fake Buffer (no real posts are created)
        </label>
        {!enabled && <p className="m-0 text-sm font-semibold">Fake mode is off: sends go to your real Buffer. Nothing below applies.</p>}
      </section>

      <section className={`grid gap-3 rounded-2xl bg-card p-5 ${enabled ? "" : "opacity-60"}`}>
        <label className="flex items-center gap-3 font-bold">
          <input type="checkbox" checked={enforceLimits} onChange={(e) => void save({ enforceLimits: e.target.checked })} className="size-5" />
          Buffer refuses over-limit captions when publishing
        </label>
        <p className="m-0 text-sm">
          Like the real Buffer: a draft may exceed a network&rsquo;s limit, but a post to publish is refused with &ldquo;cannot exceed N characters&rdquo;. &ldquo;Send now&rdquo; should never hit this, because channels with a caption over their limit become drafts instead. Off: Buffer accepts anything.
        </p>
      </section>

      <section className={`grid gap-3 rounded-2xl bg-card p-5 ${enabled ? "" : "opacity-60"}`}>
        <h2 className="m-0 text-xl">Fake channels</h2>
        <p className="m-0 text-sm">Added on top of your real channels, across all networks. Reload the Send page after changing this.</p>
        <div className="flex flex-wrap items-center gap-2">
          {CHANNEL_PRESETS.map((n) => (
            <button key={n} type="button" onClick={() => void save({ channels: n })} className={`${BUTTON} ${channels === n ? "ring-2 ring-ink" : ""}`}>
              {n}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm font-bold">
            Other
            <input type="number" min={0} max={200} value={channels} onChange={(e) => void save({ channels: Number(e.target.value) })} className={`${FIELD} w-24`} />
          </label>
        </div>
      </section>

      <section className={`grid gap-3 rounded-2xl bg-card p-5 ${enabled ? "" : "opacity-60"}`}>
        <h2 className="m-0 text-xl">What happens, per network</h2>
        <div className="grid gap-2">
          {NETWORKS.map(([key, label]) => (
            <label key={key} className="grid items-center gap-2 text-sm font-bold sm:grid-cols-[9rem_1fr]">
              {label}
              <select value={settings.behaviour?.[key] ?? "pass"} onChange={(e) => void save({ behaviour: { [key]: e.target.value as Behaviour } })} className={FIELD}>
                {BEHAVIOURS.map(([v, text]) => (
                  <option key={v} value={v}>
                    {text}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className={`grid gap-3 rounded-2xl bg-card p-5 ${enabled ? "" : "opacity-60"}`}>
        <h2 className="m-0 text-xl">Rate limit (429)</h2>
        <p className="m-0 text-sm">The next posts Pollen Picks tries to create get &ldquo;too many requests&rdquo;, then it recovers. It counts down as they happen.</p>
        <div className="flex flex-wrap items-center gap-2">
          {[0, 1, 3, 6, 12].map((n) => (
            <button key={n} type="button" onClick={() => void save({ rateLimitNext: n })} className={`${BUTTON} ${(settings.rateLimitNext ?? 0) === n ? "ring-2 ring-ink" : ""}`}>
              {n === 0 ? "Off" : `Next ${n}`}
            </button>
          ))}
          <span className="text-sm font-bold">Remaining: {settings.rateLimitNext ?? 0}</span>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save({ reset: true })} className={BUTTON}>
          Reset to env vars
        </button>
        <span className="text-xs">Saved in .dev-fake.json (not committed). Unset choices fall back to the BUFFER_FAKE* env vars.</span>
        {note && (
          <span role="alert" className="text-sm font-semibold text-coral">
            {note}
          </span>
        )}
      </div>
    </div>
  );
}
