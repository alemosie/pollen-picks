export type ParsedDate = {
  /** ISO dates (YYYY-MM-DD) found in the date line, in order. */
  dates: string[];
  /** "Weekly", "Starting 23 Oct", "Starts 20 Oct": still joinable after the first date. */
  recurring: boolean;
  /** First time found, "HH:MM". */
  startTime?: string;
};

export type Activity = {
  /** Stable id: position in the section. */
  id: number;
  title: string;
  /** Sub-heading above the list ("Good for babies", "West"), if any. */
  group?: string;
  /** The activity's own link, as written in the newsletter (may lack a scheme). Null when the bullet has none. */
  url: string | null;
  /** url after normalization; the key used to match click data. */
  key: string | null;
  /** Other links in the title line (e.g. a partner: "Dutch for Parents 🤝 Postpartum Post"). */
  hostLinks: string[];
  /** Links inside the blurb (may point to the organizer's site or profile). */
  blurbLinks: string[];
  /** Raw date line, e.g. "Mon 26 Oct @ 9:30-12:30 — De Pijp". Null when the bullet has none. */
  dateLine: string | null;
  /** Part before the em dash, e.g. "Mon 26 Oct @ 9:30-12:30". */
  when: string | null;
  /** Part after the em dash, e.g. "De Pijp". */
  place: string | null;
  parsed: ParsedDate | null;
  blurb: string;
};

/**
 * One link's click counts, in either of beehiiv's spellings: the export/dashboard names (`total_unique_clicked_verified`)
 * used by the saved fixture, and the REST API's names (`unique_verified_clicks`) used for connected newsletters.
 */
export type ClickRow = {
  url: string;
  email: {
    total_clicked?: number;
    total_unique_clicked?: number;
    total_clicked_verified?: number;
    total_unique_clicked_verified?: number;
    clicks?: number;
    unique_clicks?: number;
    verified_clicks?: number;
    unique_verified_clicks?: number;
  };
  web: { total_clicked?: number; total_unique_clicked?: number; clicks?: number; unique_clicks?: number };
};

export type LinkStats = {
  key: string;
  /** Unique verified email clickers + unique web clickers. The ranking score. */
  score: number;
  /** Verified total clicks (email + web), used as the first tie-break. */
  totalVerified: number;
  /** How many raw click rows were merged into this key. */
  rows: number;
};

export type Ranked = Activity & { stats: LinkStats | null; upcoming: boolean | null; rank: number | null };
