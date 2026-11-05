"use client";

import { X } from "lucide-react";
import { useId, useRef } from "react";
import { primaryButton } from "@/components/FlowBar";
import { track } from "@/lib/events";

/**
 * The last step of the demo. Where the real flow creates drafts in Buffer, the demo asks for an account instead:
 * the sample issue is never sent. Already signed in? Point them at their own content.
 */
export function DemoGate({
  signedIn,
  label = "Send to Buffer",
  className = primaryButton,
  onOpen,
}: {
  signedIn: boolean;
  label?: string;
  className?: string;
  onOpen?: (button: HTMLButtonElement) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          onOpen?.(e.currentTarget);
          track("gate_opened");
          dialog.current?.showModal();
        }}
        className={className}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto w-[min(32rem,94vw)] rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full hover:bg-ink/10"
          >
            <X aria-hidden className="size-5" strokeWidth={2.5} />
          </button>
          <h2 id={titleId} className="mb-3 pr-10 text-2xl sm:text-3xl">
            Now, create your own
          </h2>
          <p className="mb-6 text-lg leading-relaxed">
            You&rsquo;ve done the demo — now it&rsquo;s time to create posts from your own content! Log into Pollen Picks to get started with beehiiv, Substack, personal blog, and more.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={signedIn ? "/source" : "/api/auth/buffer/login?next=%2Fsource"}
              onClick={() => track("login_clicked")}
              className="rounded-xl bg-coral px-6 py-3 font-bold text-ink-deep hover:brightness-95"
            >
              {signedIn ? "Choose your source" : "Log in to create"}
            </a>
            <a
              href="/feedback"
              onClick={() => track("feedback_clicked")}
              className="rounded-xl bg-honey px-6 py-3 font-bold text-ink-deep hover:brightness-95"
            >
              Leave us feedback
            </a>
          </div>
        </div>
      </dialog>
    </>
  );
}
