"use client";

import { useRef } from "react";
import { primaryButton } from "@/components/FlowBar";

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
            Create with your own content
          </h2>
          <p className="mb-6 text-lg leading-relaxed">
            This demo uses a sample issue and sample channels, so nothing can be sent to Buffer. Log in with Buffer, connect your own newsletter, and send carousels as drafts to your channels.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <a
              href={signedIn ? "/source" : "/api/auth/buffer/login?next=%2Fsource"}
              className="rounded-xl bg-ink px-6 py-3 font-bold text-cream hover:bg-ink-deep"
            >
              {signedIn ? "Choose your source" : "Log in to create"}
            </a>
            <button type="button" onClick={() => dialog.current?.close()} className="font-semibold underline underline-offset-4">
              Keep exploring the demo
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
