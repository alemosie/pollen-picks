import { Check, X } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
import { variantFor, type CaptionVariant } from "@/lib/caption";
import { captionFitState } from "@/lib/channelFit";
import { serviceLabel } from "@/lib/channels";

/**
 * Will each network's caption fit? One quiet line per network, like the pills on Send: a check when it fits whole, a cross and "over by N"
 * when it doesn't, or "N picks left out" when the generated caption only fits by dropping picks (the only times there is more to read; it
 * jumps to the caption). Every channel of a network gets the same
 * caption and has the same limit, so a network fits or doesn't as a whole. `channels` are the ticked ones (see "Posting to").
 */
export function ChannelFit({
  channels,
  captionFor,
  leftOut,
  onShow,
}: {
  channels: Channel[];
  captionFor: (v: CaptionVariant) => string;
  /** The picks the generated caption had to leave out to fit its tightest network (empty once the caption is edited by hand). Every network that uses it gets that shorter caption. */
  leftOut: (v: CaptionVariant) => string[];
  /** Jump to the tab of the caption a network uses. */
  onShow: (v: CaptionVariant) => void;
}) {
  if (channels.length === 0) return null;
  const byNetwork = new Map<string, Channel[]>();
  for (const c of channels) byNetwork.set(c.service, [...(byNetwork.get(c.service) ?? []), c]);
  const networks = [...byNetwork.entries()].sort(([a], [b]) => serviceLabel(a).localeCompare(serviceLabel(b), "en"));
  return (
    <aside aria-label="Channel limits" className="grid content-start gap-2 text-sm">
      <p className="m-0 font-semibold">Fits on</p>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {networks.map(([service, group]) => {
          const variant = variantFor(service);
          const { state, label } = captionFitState(service, captionFor(variant), leftOut(variant).length);
          const ok = state === "fits";
          return (
            <li key={service} className="flex items-center gap-2" title={group.map((c) => c.name).join(", ")}>
              <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full text-ink-deep ${ok ? "bg-sage" : "bg-coral"}`}>
                {ok ? <Check className="size-3" strokeWidth={4} /> : <X className="size-3" strokeWidth={4} />}
              </span>
              <ChannelIcon service={service} className="size-3.5 shrink-0" />
              <span className="min-w-0 truncate">
                {serviceLabel(service)} <span className="opacity-75">({group.length})</span>
              </span>
              <span className="sr-only">{ok ? "caption fits" : label}</span>
              {!ok && (
                <button type="button" onClick={() => onShow(variant)} className="ml-auto shrink-0 font-semibold underline underline-offset-4">
                  {label}
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
