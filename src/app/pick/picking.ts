/** The ways to choose content, used as the `?picking=` URL param. */
export const PICKING = ["top-clicks", "section", "manual"] as const;
export type View = (typeof PICKING)[number];

export const parsePicking = (v: string | string[] | undefined): View | undefined => PICKING.find((p) => p === v);
