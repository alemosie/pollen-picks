import { Check, X } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
import { fitFor, variantFor, type CaptionVariant } from "@/lib/caption";
import { serviceLabel } from "@/lib/channels";

const byService = (a: Channel, b: Channel) =>
  serviceLabel(a.service).localeCompare(serviceLabel(b.service), "en") || a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });

/**
 * Will each connected channel take its caption? One quiet line per channel: a check when it fits, a cross and "over by N" when it
 * doesn't (the only time there is more to read; it jumps to the caption to shorten). Which channels are ticked is chosen on Send.
 */
export function ChannelFit({
  channels,
  captionFor,
  onShow,
}: {
  channels: Channel[];
  captionFor: (v: CaptionVariant) => string;
  /** Jump to the tab of the caption a channel uses. */
  onShow: (v: CaptionVariant) => void;
}) {
  if (channels.length === 0) return null;
  return (
    <aside aria-label="Channel limits" className="grid content-start gap-2 text-sm">
      <p className="m-0 font-semibold">Fits on</p>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {[...channels].sort(byService).map((c) => {
          const variant = variantFor(c.service);
          const fit = fitFor(c.service, captionFor(variant));
          return (
            <li key={c.id} className="flex items-center gap-2">
              <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full text-ink-deep ${fit.fits ? "bg-sage" : "bg-coral"}`}>
                {fit.fits ? <Check className="size-3" strokeWidth={4} /> : <X className="size-3" strokeWidth={4} />}
              </span>
              <ChannelIcon service={c.service} className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate" title={c.name}>
                {c.name}
              </span>
              <span className="sr-only">{fit.fits ? "fits" : fit.over > 0 ? `over the limit by ${fit.over}` : `${fit.mentionsOver} too many tags`}</span>
              {!fit.fits && (
                <button type="button" onClick={() => onShow(variant)} className="ml-auto shrink-0 font-semibold underline underline-offset-4">
                  {fit.over > 0 ? `over by ${fit.over.toLocaleString("en")}` : `${fit.mentionsOver} too many tags`}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="m-0 mt-1 text-xs">Edit captions per network in Buffer.</p>
    </aside>
  );
}
