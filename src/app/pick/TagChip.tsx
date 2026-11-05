import { ChannelIcon } from "@/components/ChannelIcon";

/**
 * What a pick shows about its Instagram tag. `handle`: the account to tag. `loading` / `missing` / `failed`: a post link whose
 * account is being looked up, wasn't found, or couldn't be reached (`onRetry` tries again). `limit`: this user's free lookups are
 * used up; `refused`: Apify turned down their own token (both offer `onConnect`, which opens the token form). `paused`: the app-wide monthly cap is reached. null: nothing to show.
 */
export type TagState =
  | { kind: "handle"; handle: string }
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "limit"; onConnect: () => void }
  | { kind: "refused"; onConnect: () => void }
  | { kind: "paused" }
  | { kind: "failed"; onRetry: () => void }
  | null;

/**
 * Plain text on purpose: the card it sits in is a checkbox label, so a link here would fight the click. The retry is the one
 * button, and it stops the click from toggling the pick.
 */
export function TagChip({ state, small = false, className = "" }: { state: TagState; small?: boolean; className?: string }) {
  if (!state) return null;
  const size = small ? "px-2 py-0.5" : "px-2.5 py-1";
  const icon = small ? "size-3" : "size-3.5";
  const base = `inline-flex w-fit max-w-full items-center gap-1.5 rounded-full text-xs font-bold ${size} ${className}`;
  if (state.kind === "handle") {
    return (
      <span title={`This pick links to Instagram's @${state.handle}. The Instagram caption tags it.`} className={`${base} bg-ink/10`}>
        <ChannelIcon service="instagram" className={`${icon} shrink-0`} />
        <span className="sr-only">Instagram account: </span>
        <span className="truncate">@{state.handle}</span>
      </span>
    );
  }
  if (state.kind === "loading") {
    return (
      <span role="status" className={`${base} bg-ink/5 font-semibold`}>
        <ChannelIcon service="instagram" className={`${icon} shrink-0 animate-pulse`} />
        Finding the account…
      </span>
    );
  }
  return (
    <span role="status" className={`${base} bg-coral/20 font-semibold`}>
      <ChannelIcon service="instagram" className={`${icon} shrink-0`} />
      {state.kind === "missing"
        ? "No account found for this post"
        : state.kind === "limit"
          ? "Free account lookups used up"
          : state.kind === "paused"
            ? "Account lookups are paused for now"
            : state.kind === "refused"
              ? "Apify refused your token"
              : "Couldn't find the account"}
      {(state.kind === "failed" || state.kind === "limit" || state.kind === "refused") && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.kind === "failed") state.onRetry();
            else state.onConnect();
          }}
          className="font-bold underline underline-offset-2"
        >
          {state.kind === "failed" ? "Try again" : state.kind === "limit" ? "Add your Apify token" : "Update token"}
        </button>
      )}
    </span>
  );
}
