// Dates of the Buffer Commit contest the app is built for (https://buffer.com/api/commit).

/**
 * When the feedback prompt and the project banner go: 12 Nov 2026 at 00:00 in Amsterdam (CET), which is 11 Nov 23:00 UTC. It is cut off a day before the
 * contest's feedback deadline so the demo video can be recorded without them.
 */
export const FEEDBACK_UNTIL = Date.UTC(2026, 10, 11, 23, 0, 0);

/** Whether the "Did everything go as expected?" prompt is still shown. */
export const feedbackOpen = (now: number = Date.now()) => now < FEEDBACK_UNTIL;
