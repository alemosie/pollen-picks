import { LogOut } from "lucide-react";
import Link from "next/link";

/** Top right of every signed-in page: where your history is, Settings, and Log out. `current` marks the page you are on. */
export function AccountLinks({ current }: { current?: "history" | "settings" }) {
  const link = (href: string, label: string, id: "history" | "settings") =>
    current === id ? (
      <span aria-current="page" className="font-bold">
        {label}
      </span>
    ) : (
      <Link href={href} className="underline underline-offset-4">
        {label}
      </Link>
    );
  return (
    <span className="flex items-center gap-3 whitespace-nowrap text-sm font-semibold min-[360px]:gap-4 sm:gap-5">
      {link("/history", "History", "history")}
      {link("/settings", "Settings", "settings")}
      {/* A plain link, not next/link: it must not be prefetched, or just showing the header could log you out. */}
      <a href="/api/auth/buffer/logout" aria-label="Log out" title="Log out" className="grid size-8 place-items-center rounded-full hover:bg-ink/10">
        <LogOut aria-hidden className="size-5" strokeWidth={2.25} />
      </a>
    </span>
  );
}
