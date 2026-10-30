import Link from "next/link";

export function Logo({ height = 40, href = "/" }: { height?: number; href?: string }) {
  return (
    <Link href={href} aria-label="Pollen Picks home" className="inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/pollen-picks-lockup-light.svg" alt="Pollen Picks" height={height} style={{ height }} className="w-auto" />
    </Link>
  );
}
