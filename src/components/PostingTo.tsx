"use client";

import { ChannelIcon } from "@/components/ChannelIcon";
import type { Channel } from "@/components/ChannelPicker";
import { serviceLabel } from "@/lib/channels";
import { splitNetworks, toggleNetwork } from "@/lib/postingTo";

/**
 * "Posting to": which networks the slides and the caption are being checked against, on Design and Write. A network is a small pill you can tap:
 * tapping one that is ticked moves it to "Unselected channels", tapping one there brings it back (all of its channels at once; choosing single channels is
 * for Send). It changes the same saved selection as Send, so the choice made here is the one waiting there. A network that is left out says what it
 * would have limited (`hint`), so a limit does not vanish without a word.
 */
export function PostingTo({
  channels,
  selected,
  setSelected,
  hint,
}: {
  channels: Channel[];
  selected: Set<string>;
  setSelected: (fn: (s: Set<string>) => Set<string>) => void;
  /** What a network that is left out would have limited, as a short phrase ("first 4 slides only"), or null when it would have been fine. */
  hint: (service: string) => string | null;
}) {
  const { on, off } = splitNetworks(channels, selected);
  if (on.length + off.length === 0) return null;
  const toggle = (svc: string, turnOn: boolean) => setSelected((s) => toggleNetwork(channels, s, svc, turnOn));
  const pill = (svc: string, isOn: boolean) => {
    const why = isOn ? null : hint(svc);
    return (
      <li key={svc}>
        <button
          type="button"
          aria-pressed={isOn}
          onClick={() => toggle(svc, !isOn)}
          title={isOn ? `Stop posting to ${serviceLabel(svc)}` : `Post to ${serviceLabel(svc)}`}
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-bold transition ${isOn ? "bg-ink text-cream" : "bg-ink/10 ring-1 ring-ink/15 hover:bg-ink/15"}`}
        >
          <ChannelIcon service={svc} className="size-3.5 shrink-0" />
          {serviceLabel(svc)}
          {why && <span className="font-normal opacity-80">· {why}</span>}
        </button>
      </li>
    );
  };
  return (
    <aside aria-label="Posting to" className="grid content-start gap-2 text-sm">
      <p className="m-0 text-base font-semibold">Posting to</p>
      {on.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">{on.map((svc) => pill(svc, true))}</ul>
      ) : (
        <p className="m-0">No channel ticked: checking against all of them.</p>
      )}
      {off.length > 0 && (
        <details open={on.length === 0}>
          <summary className="cursor-pointer font-semibold underline-offset-4 hover:underline">Unselected channels ({off.length})</summary>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">{off.map((svc) => pill(svc, false))}</ul>
        </details>
      )}
    </aside>
  );
}
