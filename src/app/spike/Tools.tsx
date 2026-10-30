"use client";
import { useState } from "react";

export default function Tools({ channels }: { channels: { id: string; name: string; service: string }[] }) {
  const [channelId, setChannelId] = useState(channels[0]?.id ?? "");
  const [out, setOut] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function call(url: string, init?: RequestInit) {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const raw = await res.text();
      try {
        setOut(JSON.stringify(JSON.parse(raw), null, 2));
      } catch {
        setOut(`HTTP ${res.status}, non-JSON body:\n${raw.slice(0, 2000) || "(empty)"}`);
      }
    } catch (e) {
      setOut(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <label>
        Channel for the test draft (use a throwaway channel):{" "}
        <select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.service} · {c.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button disabled={busy} onClick={() => call("/api/spike/introspect")}>
          1. Read createPost schema
        </button>
        <button
          disabled={busy || !channelId}
          onClick={() => call("/api/spike/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, service: channels.find((c) => c.id === channelId)?.service }) })}
        >
          2. Create 2-image draft
        </button>
      </div>
      <pre style={{ background: "#111", color: "#eee", padding: 12, overflow: "auto", maxHeight: 420 }}>{out || "Output appears here."}</pre>
    </div>
  );
}
