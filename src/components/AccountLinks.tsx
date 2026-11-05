import Link from "next/link";

/** Top right of every signed-in page: where your history is, and Settings (which holds Log out). `current` marks the page you are on. */
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
    <span className="flex items-center gap-5 text-sm font-semibold">
      {link("/history", "History", "history")}
      {link("/settings", "Settings", "settings")}
    </span>
  );
}
