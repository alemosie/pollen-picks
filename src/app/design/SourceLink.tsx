import { ExternalLink } from "lucide-react";

/** "Go to source link": opens the page a pick links to in a new tab. Renders nothing for a pick without a link. */
export function SourceLink({ url, title, size = "size-6" }: { url?: string; title: string; size?: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      draggable={false}
      aria-label={`Go to source link for ${title} (opens in a new tab)`}
      title="Go to source link"
      className={`grid ${size} shrink-0 place-items-center rounded-full hover:bg-ink/10`}
    >
      <ExternalLink aria-hidden className="size-4" />
    </a>
  );
}
