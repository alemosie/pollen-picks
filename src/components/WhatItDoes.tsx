import { Reveal } from "@/components/path/PollenPath";

type Shot = {
  src: string;
  alt: string;
  /** Which part of the picture stays in frame when it is cropped to the shared shape (CSS object-position). */
  position?: string;
};
type Example = {
  /** The small heading: whose newsletter this is. */
  org: string;
  description: string;
  before: Shot;
  after: Shot;
};

/**
 * Before and after pairs for the section under the hero. Add an example here and it joins the section.
 * Pictures live in public/images/what-it-does/. Both sides are cropped to one shape so each pair lines up, so put what matters in view.
 */
const EXAMPLES: Example[] = [
  {
    org: "A nonprofit organization",
    description:
      "The bi-monthly activities newsletter becomes an Instagram carousel with the newsletter\u2019s most clicked content \u2014 plus organizer tagging.",
    before: {
      src: "/images/what-it-does/newsletter-before.png",
      alt: "A newsletter section called What\u2019s happening around town, with Sint Maarten events listed with links, dates and descriptions.",
      position: "top",
    },
    after: {
      src: "/images/what-it-does/instagram-after.png",
      alt: "An Instagram post from Amsterdam Parent Project: a carousel slide for A Big Dill Pickle Exhibition, with a caption listing events and the accounts tagged in them.",
    },
  },
];

/** A hand-drawn arrow in the style of the headline's underline: a gentle coral wave (the same shallow S as the underline) into a symmetric open head, and a few specks of pollen. Points down on phones. */
function Arrow() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 40"
      className="mx-auto w-12 rotate-90 overflow-visible md:w-14 md:rotate-0"
    >
      {/* The line arrives level at the tip (58, 20), and the head's two arms are mirror images of each other around it. */}
      <path
        d="M3 21 C 14 14, 22 27, 33 20 C 44 13, 48 21, 58 20"
        fill="none"
        stroke="#f28482"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M50 12 L 58 20 L 50 28"
        fill="none"
        stroke="#f28482"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15" cy="9" r="3.5" fill="#f6bd60" />
      <circle cx="40" cy="31" r="3" fill="#f6bd60" />
      <circle cx="28" cy="8" r="2" fill="#2b3a36" />
    </svg>
  );
}

/** A chunky frame: a thick mat in one colour with a half-strength hard shadow, a hard shadow, and the label stuck on its top edge like a sticker. */
function Frame({ shot, label, tone, sticker, tilt }: { shot: Shot; label: string; tone: string; sticker: string; tilt: string }) {
  return (
    <div
      className={`relative min-w-0 rounded-[2rem] p-3 sm:p-4 ${tone} ${tilt}`}
    >
      <span className={`absolute -top-5 left-6 rotate-[-3deg] rounded-full border-[3px] ${sticker} bg-surface px-5 py-1 font-display text-xl leading-tight`}>
        {label}
      </span>
      {/* One shared shape, so the pair lines up whatever the pictures' own proportions. */}
      <div className="relative aspect-[773/556] overflow-hidden rounded-2xl border-[3px] border-surface bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.src}
          alt={shot.alt}
          loading="lazy"
          decoding="async"
          style={{ objectPosition: shot.position }}
          className="absolute inset-0 size-full object-cover"
        />
      </div>
    </div>
  );
}

export function WhatItDoes() {
  const showText = EXAMPLES.length > 1;
  return (
    <section
      id="what-it-does"
      aria-labelledby="what-it-does-title"
      className="mx-auto max-w-6xl px-6 pb-4 sm:pb-8"
    >
      <Reveal>
        <h2 id="what-it-does-title" className="mb-12 text-center text-3xl leading-tight sm:text-5xl">
          Words in, <span className="pp-squig">posts out</span>
        </h2>
      </Reveal>
      <div className="grid gap-16">
        {EXAMPLES.map((ex, i) => (
          <Reveal key={ex.org} delay={i === 0 ? 0 : 0.05}>
            {/* The name and description only appear once there is more than one example, to tell them apart. */}
            {showText && (
              <div className="mx-auto mb-10 max-w-2xl text-center">
                <h3 className="mb-2 font-display text-xl leading-tight sm:text-2xl">{ex.org}</h3>
                <p className="m-0 text-balance text-lg leading-relaxed sm:text-xl">{ex.description}</p>
              </div>
            )}
            <div className="mx-auto grid w-4/5 max-w-[55rem] items-center gap-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-6">
              <Frame shot={ex.before} label="Before" tone="bg-blush shadow-[7px_7px_0_0_#f5cac380]" sticker="border-blush" tilt="md:-rotate-1" />
              <Arrow />
              <Frame shot={ex.after} label="After" tone="bg-sage shadow-[7px_7px_0_0_#84a59d80]" sticker="border-sage" tilt="md:rotate-1" />
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
