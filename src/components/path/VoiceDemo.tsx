import type { VoiceExample } from "@/lib/voiceExample";
import { ShareSlide } from "./ShareSlide";

type Found = "title" | "date" | "blurb";
const MARK: Record<Found, string> = { title: "bg-honey", date: "bg-sage", blurb: "bg-blush" };
const TAG: Record<Found, { text: string; tilt: string }> = {
  title: { text: "Title", tilt: "-rotate-3" },
  date: { text: "Date", tilt: "rotate-2" },
  blurb: { text: "Your words", tilt: "-rotate-1" },
};

/**
 * Static before and after: a paragraph as the writer typed it, with what the rules found in it marked, and the slide
 * card it becomes. The words on the card are the writer's own. No motion, so it stays light on phones.
 */
export function VoiceDemo({ example }: { example: VoiceExample }) {
  return (
    <div className="grid max-w-2xl items-start gap-5 sm:grid-cols-[1fr_minmax(0,13rem)] sm:gap-7">
      <div>
        <h3 className="mb-2 font-display text-xl leading-tight">From your source text&hellip;</h3>
        <p className="m-0 -rotate-1 rounded-2xl bg-surface p-4 text-[0.95rem] leading-[1.9] ring-1 ring-ink/10">
          {example.parts.map((p, i) => (
            <span
              key={i}
              className={p.found ? `rounded-sm ${MARK[p.found]} [box-decoration-break:clone]` : undefined}
            >
              {p.text}
            </span>
          ))}
        </p>
        <p className="m-0 mt-4 flex flex-wrap gap-2" aria-label="What the rules found">
          {(Object.keys(TAG) as Found[]).map((f) => (
            <span
              key={f}
              className={`${TAG[f].tilt} ${MARK[f]} rounded-full px-2.5 py-1 text-xs font-bold shadow-sm`}
            >
              {TAG[f].text} &#10003;
            </span>
          ))}
        </p>
      </div>

      <div className="w-full max-w-[13rem] sm:max-w-none">
        <h3 className="mb-2 font-display text-xl leading-tight">&hellip;to share-worthy</h3>
        <div className="relative aspect-[4/5] rotate-1 rounded-3xl bg-card p-4 shadow-lg ring-1 ring-ink/10">
          <p className="font-display text-lg leading-tight">{example.title}</p>
          {example.when && (
            <p className="mt-3 inline-block rounded-full bg-sage px-2.5 py-0.5 text-xs font-semibold">
              {example.when}
            </p>
          )}
          <p className="mt-2 line-clamp-6 text-sm leading-snug">{example.blurb}</p>
          <ShareSlide />
        </div>
      </div>
    </div>
  );
}
