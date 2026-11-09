import { Check, X } from "lucide-react";
import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
import { imageLimit, serviceLabel, unsupportedReason } from "@/lib/channels";

/**
 * Will every slide fit? One quiet line per network, like "Fits on" for captions on Write: a check when the network takes all the slides,
 * a cross and "first N of M" when it takes fewer (it posts only the first ones). Several channels of a network share its limit.
 */
export function SlideFit({ channels, slideCount }: { channels: Channel[]; slideCount: number }) {
  const byNetwork = new Map<string, number>();
  for (const c of channels) if (!unsupportedReason(c.service)) byNetwork.set(c.service, (byNetwork.get(c.service) ?? 0) + 1);
  if (byNetwork.size === 0) return null;
  const networks = [...byNetwork.entries()].sort(([a], [b]) => serviceLabel(a).localeCompare(serviceLabel(b), "en"));
  const anyCut = networks.some(([s]) => slideCount > imageLimit(s));
  return (
    <aside aria-label="Slide limits" className="grid content-start gap-2 text-sm">
      <p className="m-0 font-semibold">Fits on</p>
      <ul className="m-0 grid list-none gap-2 p-0">
        {networks.map(([service, n]) => {
          const room = imageLimit(service);
          const cut = slideCount > room;
          return (
            <li key={service} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span aria-hidden className={`grid size-4 shrink-0 place-items-center rounded-full text-ink-deep ${cut ? "bg-coral" : "bg-sage"}`}>
                {cut ? <X className="size-3" strokeWidth={4} /> : <Check className="size-3" strokeWidth={4} />}
              </span>
              <ChannelIcon service={service} className="size-3.5 shrink-0" />
              <span>
                {serviceLabel(service)} <span className="opacity-75">({n})</span>
              </span>
              <span className={`basis-full pl-[1.625rem] text-xs ${cut ? "font-semibold" : "opacity-75"}`}>
                {cut ? `first ${room} of ${slideCount} slides` : `up to ${room} slides`}
              </span>
            </li>
          );
        })}
      </ul>
      {anyCut && <p className="m-0 text-xs">A network that takes fewer slides gets only the first ones.</p>}
    </aside>
  );
}
