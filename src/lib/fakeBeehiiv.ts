// Development only: pretend beehiiv publications, so the whole "connected with a key" flow (connect, list issues, pick, rank,
// dates, captions) can be tried without a real key and without real data. Paste FAKE_KEY into Connect beehiiv while running
// `yarn dev`. Never active in production builds.
//
// Four publications, each laid out differently on purpose. Every date is relative to today, so the issues stay "current".
//   a1 Brooklyn Weekend Guide  US dates in a bold line ("Sat, Oct 24 · 9-11am"), no italic date line, a big feature story and a
//                              sponsor with more clicks than any event, past events with lots of clicks, links with tracking
//                              parameters in the body that the click data doesn't have
//   a2 Dev Links Digest        no dates at all: every link is a pick; duplicate click rows for one link; footer links
//   a3 Date Soup               italic date lines in many formats (ranges, "Until...", "Every Tuesday", numeric, and "this Saturday", which is not read),
//                              undated items, group labels, blocks wrapped in divs like the real beehiiv web page, and a link whose
//                              query string differs between the body and the click data
//   a4 Welly Weekend           no bullets: emoji + linked title, a description paragraph, a details line ("📍 venue | 🕖 Fri 7:30pm | 💲 Free");
//                              dates only in "Friday / Saturday / Sunday" subheadings; "Quick Picks" lines that link to the same events;
//                              bold venue lead-ins, a sponsor with a button link, weather and charity links
// Each has three issues: 3, 10 and 17 days old (the older ones have mostly past events, which is what the ranking has to cope with).

import type { BeehiivIssueContent, BeehiivIssuePage, BeehiivPublication } from "./beehiiv";
import type { ClickRow } from "./pollen/types";

export const FAKE_KEY = "fake_beehiiv_key_0000000000";
export const isFakeKey = (key: string) => process.env.NODE_ENV !== "production" && /^fake_beehiiv_key/i.test(key);

const DAY = 86400000;
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const issueDate = (daysAgo: number) => {
  const t = new Date();
  t.setUTCHours(10, 0, 0, 0);
  return new Date(t.getTime() - daysAgo * DAY);
};
const plus = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const wd = (d: Date) => WD[d.getUTCDay()];
const mo = (d: Date) => MO[d.getUTCMonth()];
const dn = (d: Date) => d.getUTCDate();
const md = (d: Date) => `${mo(d)} ${dn(d)}`;
const dm = (d: Date) => `${dn(d)} ${mo(d)}`;
const range = (a: Date, b: Date) => (mo(a) === mo(b) ? `${md(a)}-${dn(b)}` : `${md(a)}-${md(b)}`);

const PUB_CODES = ["a1", "a2", "a3", "a4"] as const;
const pubId = (code: string) => `pub_00000000-0000-4000-8000-0000000000${code}`;
const postId = (code: string, n: number) => `post_00000000-0000-4000-8000-00000000${code}${String(n).padStart(2, "0")}`;
const AGES = [3, 10, 17];

/** One click row in the REST API's spelling. `email` counts are unique verified clickers; the body link may carry extra parameters the row doesn't. */
const click = (url: string, email: number, web = 0): ClickRow => ({
  url: `${url}${url.includes("?") ? "&" : "?"}utm_source=fake.beehiiv.com&utm_medium=newsletter&utm_campaign=fake-issue`,
  email: { unique_verified_clicks: email, verified_clicks: email + Math.ceil(email / 3), unique_clicks: email + 2, clicks: email + Math.ceil(email / 3) + 2 },
  web: { unique_clicks: web, clicks: web },
});
/** The body's copy of a link carries beehiiv's own tracking parameter. */
const bh = (url: string) => `${url}${url.includes("?") ? "&" : "?"}_bhlid=7f3a9c1d2b`;
const ev = (slug: string) => `https://fake-events.example/${slug}`;

type Built = { html: string; clicks: ClickRow[]; title: string };

// ---- a1: Brooklyn Weekend Guide ------------------------------------------------------------------------------------

function brooklyn(b: Date): Built {
  const clicks: ClickRow[] = [];
  const item = (slug: string, title: string, when: string, place: string, blurb: string, n: number, web = 0) => {
    clicks.push(click(ev(slug), n, web));
    return `<li><p><a href="${bh(ev(slug))}">${title}</a></p><p><b>${when}</b> · ${place}</p><p>${blurb}</p></li>`;
  };
  clicks.push(click("https://fake-news.example/l-train-shutdown", 90, 20));
  clicks.push(click("https://acme-bank.example/offer", 150));
  clicks.push(click("https://fake.beehiiv.com/unsubscribe", 4));
  clicks.push(click("https://fake.beehiiv.com/preferences", 3));
  const d3 = plus(b, 3), d4 = plus(b, 4), d12 = plus(b, 12);
  const html = [
    `<h1>Your Brooklyn weekend</h1>`,
    `<p>Hi neighbors, here is what is on this week. <a href="${bh("https://fake.beehiiv.com/archive")}">Read the archive</a>.</p>`,
    `<h2>The big story</h2>`,
    `<p><a href="${bh("https://fake-news.example/l-train-shutdown")}">Why the L train is closing again</a> and what to do about it. A long read about commuting in the borough this winter.</p>`,
    `<h2>This weekend</h2>`,
    `<ul>`,
    item("fall-fest", "Prospect Park Fall Fest", `${wd(d3)}, ${md(d3)} · 9–11am`, "Prospect Park", "Hay rides, cider and a costume contest for the little ones.", 41, 6),
    item("pumpkin-patch", "Pumpkin Patch at Smorgasburg", `${wd(d4)}, ${md(d4)} · 11am–4pm`, "Williamsburg", "Pick a pumpkin, carve it on the spot.", 37),
    item("pottery-popup", "Kids' Pottery Pop-up", `${wd(d3)} ${md(d3)}, 2pm`, "Gowanus", "Drop in and make a bowl. Ages 4 and up.", 25),
    item("farmers-market", "Yesterday's Farmers Market", `${wd(plus(b, -1))}, ${md(plus(b, -1))} · 8am–2pm`, "Grand Army Plaza", "Already over by the time you read this, with lots of clicks.", 120),
    `</ul>`,
    `<h2>Later this month</h2>`,
    `<ul>`,
    item("halloween-parade", "Halloween Parade", `${wd(d12)}, ${md(d12)} · 6pm`, "Park Slope", "The big one. Bring a flashlight.", 60),
    item("costume-swap", "Costume Swap", `${wd(plus(b, 1))}, ${md(plus(b, 1))} · 6pm`, "Cobble Hill Library", "Trade the costume your kid outgrew.", 30),
    `<li><p><a href="${bh(ev("story-time"))}">Story Time at the Library</a></p><p>Every Wednesday at 10:30am. No sign-up needed.</p></li>`,
    `</ul>`,
    `<h2>Presented by Acme Bank</h2>`,
    `<p><a href="${bh("https://acme-bank.example/offer")}">Open a kids' savings account and get $50</a>. Member FDIC. Terms apply.</p>`,
    `<p>You are receiving this because you signed up. <a href="${bh("https://fake.beehiiv.com/unsubscribe")}">Unsubscribe</a> · <a href="${bh("https://fake.beehiiv.com/preferences")}">Manage preferences</a></p>`,
  ].join("\n");
  clicks.push(click(ev("story-time"), 12));
  return { html, clicks, title: `Weekend guide: ${md(d3)}` };
}

// ---- a2: Dev Links Digest ------------------------------------------------------------------------------------------

function digest(b: Date): Built {
  const links: [string, string, string, number, number][] = [
    ["rust-async", "How async Rust actually works", "A walk through wakers and executors, with diagrams.", 52, 9],
    ["sqlite-wal", "SQLite's write-ahead log, explained", "Why it is fast and when it bites.", 47, 0],
    ["css-nesting", "Native CSS nesting is here", "What changed and what you can drop from your build.", 33, 14],
    ["postgres-skip-locked", "A job queue in one Postgres table", "FOR UPDATE SKIP LOCKED, leases, and retries.", 29, 0],
    ["htmx-vs-react", "Do you need a framework for this?", "A small team's rewrite, honestly told.", 21, 5],
    ["tailwind-4", "Tailwind 4 in practice", "Ten things we changed.", 18, 0],
    ["tool-ripgrep", "Ripgrep tricks", "Globs, types and multiline.", 11, 0],
    ["tool-just", "Just: a command runner", "Replace your Makefile.", 8, 0],
  ];
  const clicks: ClickRow[] = [];
  const p = (slug: string, title: string, blurb: string, n: number, web: number) => {
    clicks.push(click(`https://fake-dev.example/${slug}`, n, web));
    return `<p><a href="${bh(`https://fake-dev.example/${slug}`)}">${title}</a> — ${blurb}</p>`;
  };
  // The same link clicked from two campaigns shows up as two rows; they have to add up.
  clicks.push(click("https://fake-dev.example/rust-async", 10));
  clicks.push(click("https://fake-sponsor.example/dash", 140));
  clicks.push(click("https://fake.beehiiv.com/upgrade", 6));
  clicks.push(click("https://fake.beehiiv.com/unsubscribe", 2));
  const html = [
    `<h1>Dev Links Digest</h1>`,
    `<p>Eight good reads this week. <a href="${bh("https://fake.beehiiv.com/upgrade")}">Upgrade</a> to get the extras.</p>`,
    `<h2>Top stories</h2>`,
    ...links.slice(0, 5).map((l) => p(...l)),
    `<h2>Tools we liked</h2>`,
    `<ul>`,
    ...links.slice(5).map(([slug, title, blurb, n, web]) => {
      clicks.push(click(`https://fake-dev.example/${slug}`, n, web));
      return `<li><p><a href="${bh(`https://fake-dev.example/${slug}`)}">${title}</a></p><p>${blurb}</p></li>`;
    }),
    `</ul>`,
    `<h2>Sponsor</h2>`,
    `<p><a href="${bh("https://fake-sponsor.example/dash")}">Monitor your jobs with Dash</a>, the dashboard for people who hate dashboards.</p>`,
    `<p><a href="${bh("https://fake.beehiiv.com/unsubscribe")}">Unsubscribe</a></p>`,
  ].join("\n");
  return { html, clicks, title: `Digest #${dn(b)}${mo(b)}` };
}

// ---- a3: Date Soup -------------------------------------------------------------------------------------------------

function soup(b: Date): Built {
  const clicks: ClickRow[] = [];
  const li = (slug: string, title: string, line: string | null, blurb: string, n: number, queryInClicks = "") => {
    clicks.push(click(`${ev(slug)}${queryInClicks}`, n));
    return `<li><p><a href="${bh(ev(slug))}">${title}</a>${line ? `<br><em>${line}</em>` : ""}</p><p>${blurb}</p></li>`;
  };
  const d3 = plus(b, 3), d5 = plus(b, 5), d6 = plus(b, 6), d9 = plus(b, 9), d31 = plus(b, 31);
  const ul = (...items: string[]) => `<ul>${items.join("")}</ul>`;
  const blocks = [
    `<h1>Date Soup</h1>`,
    `<h2>What's on</h2>`,
    `<p>West</p>`,
    ul(
      li("westerpark-run", "Westerpark Family Run", `${wd(d3)} ${dm(d3)} @ 9-11am — Westerpark`, "A gentle 3 km with a pancake finish.", 44),
      li("pancake-fest", "Pancake Festival", `${range(d5, d6)} — Museumplein`, "Two days of toppings.", 38),
      li("winter-market", "Winter Market", `Until ${md(d31)} — Dam Square`, "Open daily until the end of next month.", 27),
    ),
    `<p>East</p>`,
    ul(
      li("baby-yoga", "Baby Yoga", `Every Tuesday at 10am — Oost`, "Drop-in, mats provided.", 35),
      li("ticket-night", "Family Film Night", `${d9.getUTCMonth() + 1}/${dn(d9)}/${d9.getUTCFullYear()} @ 7pm — Zuid`, "Tickets are limited.", 22, "?ref_code=abc"),
      li("this-saturday", "Toy Swap", `this Saturday — Noord`, "Bring one, take one. A relative date: left undated on purpose.", 19),
      li("last-week", "Last Week's Bake Sale", `${wd(plus(b, -2))} ${dm(plus(b, -2))} @ 10:00 — Centrum`, "Over, but it got a lot of clicks.", 90),
      li("no-date", "Parent Support Circle", null, "Meets in a different place each month; see the site.", 15),
    ),
    `<p>Thanks for reading! <a href="${bh("https://fake.beehiiv.com/unsubscribe")}">Unsubscribe</a></p>`,
  ];
  clicks.push(click("https://fake.beehiiv.com/unsubscribe", 3));
  // The real web page wraps every block in its own div inside #content-blocks.
  const html = `<html><body><div id="content-blocks">${blocks.map((x) => `<div class="block">${x}</div>`).join("\n")}</div></body></html>`;
  return { html, clicks, title: `What's on from ${md(b)}` };
}

// ---- a4: Welly Weekend (no bullets; emoji + link, description paragraph, pipe-separated details line) ---------------------

function welly(b: Date): Built {
  const clicks: ClickRow[] = [];
  // Next Friday on or after the issue date; the "Friday / Saturday / Sunday" subheadings carry no date of their own.
  const fri = plus(b, (5 - b.getUTCDay() + 7) % 7), sun = plus(fri, 2), wed = plus(fri, 5);
  const link = (slug: string, text: string) => `<a href="${bh(ev(slug))}">${text}</a>`;
  const quick = (emoji: string, slug: string, text: string, day: string, blurb: string, n: number) => {
    clicks.push(click(ev(slug), n));
    return `<p>${emoji} ${link(slug, text)} (${day}) – ${blurb}</p>`;
  };
  // An event: emoji + linked title, a plain paragraph, then a details line (venue | time | price).
  const event = (emoji: string, slug: string, title: string, blurb: string, details: string, n: number) => {
    clicks.push(click(ev(slug), n));
    return `<p>${emoji} ${link(slug, title)}</p>\n<p>${blurb}</p>\n<p>${details}</p>`;
  };
  clicks.push(click("https://acme-outlet.example/win", 120));
  clicks.push(click("https://fake.beehiiv.com/unsubscribe", 5));
  const html = [
    `<h1>What's on in Welly: ${dn(fri)}-${dn(sun)} ${mo(fri)}</h1>`,
    `<h2>👋 Welcome</h2>`,
    `<p>Happy Thursday! A big weekend ahead. <a href="${bh("https://fake.beehiiv.com/archive")}">Read the archive</a>.</p>`,
    `<h2>🔥 Quick Picks</h2>`,
    quick("🎪", "circus", "Weber Bros presents The Circus", "Fri", "final weekend in the Hutt", 58),
    quick("🎃", "lantern-walk", "Lantern Walk at the Gardens", "Sat", "free and family friendly", 33),
    quick("🎶", "jazz-night", "Jazz at the Library", "Sun", "an easy Sunday afternoon", 14),
    `<h2>💛 Sponsor - Reduced to Clear</h2>`,
    `<p><b>Win a $200 voucher</b></p>\n<p>Enter to win at Acme Outlet.</p>\n<p><a href="${bh("https://acme-outlet.example/win")}">Enter now</a></p>`,
    `<h2>🍹 Food & Drink</h2>`,
    `<p><b>RBar</b></p>\n<p>Cuba Street's pirate-themed rum bar has reopened. Follow <a href="${bh(ev("rbar"))}">@rbar</a> for specials.</p>`,
    `<p><b>Little Beer Quarter</b></p>\n<p>New taps for summer, plus a pie of the week. <a href="${bh(ev("lbq"))}">See the tap list</a>.</p>`,
    `<h2>🎉 Events - What's On This Weekend</h2>`,
    `<h3>📅 Friday</h3>`,
    event("🎪", "circus", "Weber Bros presents The Circus", "Final weekend in Upper Hutt for the Human Cannonball.", "📍 Riverbank Park, Upper Hutt | 🕖 Fri 7:30pm, Sat 2pm &amp; 7:30pm | 💲 From $25", 58),
    event("🎬", "outdoor-cinema", "Outdoor Cinema: Moana", "Bring a blanket and a picnic.", "📍 Waitangi Park | 🕗 8:30pm | 💲 Free", 21),
    `<h3>📅 Saturday</h3>`,
    event("🏮", "lantern-walk", "Lantern Walk at the Gardens", "A glowing evening stroll through the Botanic Garden.", "📍 Wellington Botanic Garden | 🕖 7pm | 💲 Free | 👶 All ages", 33),
    event("🥕", "harbourside", "Harbourside Market", "Fresh produce, coffee and live music by the water.", "📍 Customhouse Quay | 🕗 Sat 7:30am-2pm", 47),
    `<h3>📅 Sunday</h3>`,
    event("🎶", "jazz-night", "Jazz at the Library", "Local trios play in the atrium.", "📍 Central Library | 🕑 2pm | 💲 Gold coin", 14),
    event("🏃", "park-run", "Fun Run on the Waterfront", "A 5 km run or walk for charity.", "📍 Frank Kitts Park | 🕘 9am | 💲 $15", 26),
    `<h2>👀 Heads Up - Next Week</h2>`,
    event("🎞️", "film-night", "Film Night at Light House", "A Wellington premiere with a Q&amp;A.", `📍 Light House Cuba, 29 Wigan Street, Te Aro | 🕔 ${wd(wed)} ${dm(wed)}, arrive 5:15pm`, 30),
    event("🎄", "xmas-markets", "Christmas Markets open", "Gifts from over 80 local makers.", `📍 Chaffers Market | 🗓 From ${dm(plus(fri, 14))}`, 9),
    `<h2>🌦️ Welly Weather Watch</h2>`,
    `<p>Showers clearing by Saturday. <a href="${bh("https://fake-weather.example/forecast")}">Full forecast</a>.</p>`,
    `<h2>✨ Extra Sprinkles - Charity of the Week</h2>`,
    `<p><a href="${bh(ev("charity"))}">Wellington SPCA</a> needs foster carers this summer.</p>`,
    `<p>You are receiving this because you signed up. <a href="${bh("https://fake.beehiiv.com/unsubscribe")}">Unsubscribe</a></p>`,
  ].join("\n");
  clicks.push(click("https://fake-weather.example/forecast", 70));
  clicks.push(click(ev("rbar"), 28));
  clicks.push(click(ev("lbq"), 16));
  clicks.push(click(ev("charity"), 8));
  return { html, clicks, title: `What's on in Welly: ${dn(fri)}-${dn(sun)} ${mo(fri)}` };
}

const PUBS = [
  { code: PUB_CODES[0], name: "Fake: Brooklyn Weekend Guide", build: brooklyn, subscribers: 4210, openRate: 51.2, clickRate: 6.4 },
  { code: PUB_CODES[1], name: "Fake: Dev Links Digest", build: digest, subscribers: 15800, openRate: 44.9, clickRate: 9.8 },
  { code: PUB_CODES[2], name: "Fake: Date Soup", build: soup, subscribers: 980, openRate: 58.3, clickRate: 7.1 },
  { code: PUB_CODES[3], name: "Fake: Welly Weekend", build: welly, subscribers: 7300, openRate: 49.5, clickRate: 8.2 },
];

export const fakePublications = (): BeehiivPublication[] =>
  PUBS.map((p) => ({ id: pubId(p.code), name: p.name, organization: `${p.name} Co.`, orgChecked: true, subscribers: p.subscribers, openRate: p.openRate, clickRate: p.clickRate, created: 1_700_000_000 }));

const find = (publicationId: string) => PUBS.find((p) => pubId(p.code) === publicationId);

export function fakeIssuePage(publicationId: string, page = 1, limit = 5): BeehiivIssuePage | null {
  const pub = find(publicationId);
  if (!pub) return null;
  const all = AGES.map((age, i) => {
    const b = issueDate(age);
    return { id: postId(pub.code, i + 1), title: pub.build(b).title, subtitle: "A pretend issue for testing", publishedAt: b.toISOString(), url: `https://fake.beehiiv.com/p/${pub.code}-${i + 1}` };
  });
  const start = (Math.max(1, page) - 1) * limit;
  return { issues: all.slice(start, start + limit), page, totalPages: Math.max(1, Math.ceil(all.length / limit)), totalResults: all.length };
}

export function fakeIssue(publicationId: string, post: string): BeehiivIssueContent | null {
  const pub = find(publicationId);
  const i = AGES.findIndex((_, n) => post === postId(pub?.code ?? "", n + 1));
  if (!pub || i < 0) return null;
  const b = issueDate(AGES[i]);
  const built = pub.build(b);
  return { id: post, title: built.title, publishedAt: b.toISOString(), url: `https://fake.beehiiv.com/p/${pub.code}-${i + 1}`, html: built.html, clicks: built.clicks };
}
