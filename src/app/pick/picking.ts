/** The ways to choose content, used as the `?picking=` URL param. */
export const PICKING = ["top-clicks", "section", "manual"] as const;
export type View = (typeof PICKING)[number];

export const parsePicking = (v: string | string[] | undefined): View | undefined => PICKING.find((p) => p === v);

/**
 * The Picker's React key. A fresh run (the cookie set by "choose a source") must get a new Picker: with cacheComponents the /pick page left earlier stays
 * alive in the background, and without a new key it would come back with the old run's picks in its state and save them again.
 * `freshId` is what that fresh start left in the cookie, different every time ("" when this visit is not a fresh start). It has to differ between two
 * fresh starts of the SAME issue as well, not only between fresh and not fresh: that is exactly the "start over on the same issue" case.
 */
export const pickerKey = (mode: string, issueUrl: string, freshId: string) => `${mode}|${issueUrl}${freshId ? `|fresh:${freshId}` : ""}`;
