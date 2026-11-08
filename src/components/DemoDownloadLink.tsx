"use client";

import { useState } from "react";
import { track } from "@/lib/events";
import { captionFileNames, extFor, slideFileName } from "@/lib/demoDownload";
import { makeZip, type ZipFile } from "@/lib/zip";

/** What the demo made: the slide addresses, and each caption with the networks it is for. */
export type DemoDownload = { urls: string[]; captions: { label: string; text: string }[] };

/** Slides are drawn on the server one request each, so only a few are asked for at a time. */
const AT_A_TIME = 4;

async function fetchSlide(url: string, index: number, total: number): Promise<ZipFile> {
  // Same-site, so the visitor's cookies come along: in the demo they are what says which page and highlights these slides are made from.
  const res = await fetch(url, { credentials: "same-origin" });
  const type = res.headers.get("Content-Type");
  if (!res.ok || !type?.startsWith("image/")) throw new Error(`Slide ${index + 1} failed (${res.status})`);
  return { name: slideFileName(index, total, extFor(type)), data: new Uint8Array(await res.arrayBuffer()) };
}

/**
 * "Download your demo": a soft link under the Finish demo buttons. Zips the slides and the captions (one text file per kind of network),
 * so someone without a Buffer account can post them by hand. Built in the browser from the same slide addresses the page already shows.
 */
export function DemoDownloadLink({ urls, captions }: DemoDownload) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  async function download() {
    if (state === "busy") return;
    setState("busy");
    try {
      const slides: ZipFile[] = [];
      for (let i = 0; i < urls.length; i += AT_A_TIME) {
        slides.push(...(await Promise.all(urls.slice(i, i + AT_A_TIME).map((u, j) => fetchSlide(u, i + j, urls.length)))));
      }
      const enc = new TextEncoder();
      const names = captionFileNames(captions.map((c) => c.label));
      const files: ZipFile[] = [...slides, ...captions.map((c, i) => ({ name: names[i], data: enc.encode(`${c.text}\n`) }))];
      const href = URL.createObjectURL(new Blob([makeZip(files)], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = href;
      a.download = "pollen-picks-demo.zip";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 10_000);
      track("demo_downloaded");
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <p className="m-0 mt-5 text-sm">
      <button
        type="button"
        onClick={download}
        disabled={state === "busy"}
        title="The slides and captions as a zip, to post yourself"
        className="font-semibold underline underline-offset-4 hover:no-underline disabled:cursor-progress disabled:no-underline"
      >
        {state === "busy" ? "Preparing your download…" : "Download your demo"}
      </button>
      <span role="status" className="ml-2 font-semibold text-coral">
        {state === "error" ? "Couldn\u2019t prepare the download. Try again." : ""}
      </span>
    </p>
  );
}
