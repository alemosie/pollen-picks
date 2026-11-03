"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";
import { stepUrl } from "@/lib/flow";
import { loadPicked } from "@/lib/progress";
import { DEMO_HL_PARAM, readDemoValue } from "@/lib/pollen/demoHighlights";

/**
 * Copies a link to the current step. Everything that shapes the result (picks, layout, text, colors) lives in the URL,
 * so anyone who opens it and logs in with their own Buffer account sees the same thing and can post it themselves.
 * `kind="pick"`: the Pick page's URL doesn't hold the selection, so it's added from what's saved in this browser.
 * `getUrl`: pages that build their link from live state pass their own.
 * `mode`: which content source the link is for (the public demo by default).
 * `title`: tooltip, for pages where the default wording (post it from their own Buffer account) doesn't fit.
 */
export function ShareLinkButton({
  kind = "current",
  getUrl,
  mode = "demo",
  title = "Anyone with this link can open this and post it from their own Buffer account",
}: {
  kind?: "current" | "pick";
  getUrl?: () => string;
  mode?: string;
  title?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let url = getUrl?.() ?? window.location.href;
    if (!getUrl && kind === "pick") {
      const ids = loadPicked() ?? [];
      url = `${window.location.origin}${stepUrl(mode, "pick", ids.length ? `picks=${ids.join(",")}` : "")}`;
    }
    // A demo link also carries the highlights (the sharer's own, kept in a cookie), which the recipient's browser doesn't have.
    const hl = readDemoValue();
    if (hl) {
      const u = new URL(url, window.location.origin);
      if (u.pathname.startsWith("/demo/")) {
        u.searchParams.set(DEMO_HL_PARAM, hl);
        url = u.toString();
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      window.prompt("Copy this link", url);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={title}
      className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-surface px-4 py-2.5 font-bold ring-1 ring-ink/15 transition hover:ring-ink/40"
    >
      {copied ? (
        <Check aria-hidden className="size-4" strokeWidth={3} />
      ) : (
        <Link2 aria-hidden className="size-4" />
      )}
      <span role="status">{copied ? "Link copied" : "Copy share link"}</span>
    </button>
  );
}
