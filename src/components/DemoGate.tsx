"use client";

import { useRef } from "react";
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
        aria-labelledby="demo-gate-title"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-auto w-[min(32rem,94vw)] rounded-2xl bg-page p-0 text-ink backdrop:bg-ink/60"
      >
        <div className="p-6 sm:p-8">
          <h2 id="demo-gate-title" className="mb-3 text-2xl sm:text-3xl">
            Now, create your own
          </h2>
          <p className="mb-6 text-lg leading-relaxed">
            You&rsquo;ve done the demo. Now it&rsquo;s time to create posts from your own newsletter content. Log into Pollen Picks to get started with your beehiiv or Substack publication.
          </p>
          <div className="mb-6 flex flex-wrap items-center gap-3">
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
              className="rounded-xl px-6 py-3 font-bold ring-1 ring-ink/40 hover:bg-ink/10"
            >
              Leave us feedback
            </a>
          </div>
          <p className="mb-0 text-sm leading-relaxed">
            The more users and more feedback we get, the better the chance we can win{" "}
            <a href="https://buffer.com/api/commit" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
              Buffer Commit
            </a>
            . Contest winnings would go towards funding new parent support groups with nonprofit{" "}
            <a href="https://amsterdamparentproject.nl" target="_blank" rel="noopener noreferrer" className="font-bold underline underline-offset-4">
              Amsterdam Parent Project
            </a>
            .
          </p>
          <button type="button" onClick={() => dialog.current?.close()} className="mt-5 text-sm font-semibold underline underline-offset-4">
            Keep exploring the demo
          </button>
        </div>
      </dialog>
    </>
  );
}
