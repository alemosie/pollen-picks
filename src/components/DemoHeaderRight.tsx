import { AuthLink } from "@/components/AuthLink";

/** Right side of the page header in the demo: no Settings or Log out, a way into the real app instead. */
export function DemoHeaderRight() {
  return (
    <AuthLink
      className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-ink-deep"
      loggedOut="Log in to create"
      loggedIn="Open app"
    />
  );
}
