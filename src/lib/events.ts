// Funnel events: which step of the flow was reached, which content was used, and a random id for this browser tab (so a
// visit's events and its feedback can be read together). No cookie, no content, nothing that identifies a person.
// Each event is sent once per browser tab session.

export const DEMO_EVENTS = [
  "demo_start",
  "pick_reached",
  "highlight_added",
  "design_reached",
  "write_reached",
  "send_reached",
  "gate_opened",
  "login_clicked",
  "feedback_clicked",
] as const;
export type DemoEvent = (typeof DEMO_EVENTS)[number];
/** Which content the visitor used; more sources are added here as the demo gets them. */
export type DemoEventSource = "sample";

/** A random id for this browser tab, so one visit's events and feedback can be read together. Not tied to a person. */
export function sessionId(): string | null {
  try {
    let id = sessionStorage.getItem("pp_sid");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("pp_sid", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Browser side. Best effort: a failure never gets in the visitor's way. */
export function track(event: DemoEvent, source: DemoEventSource = "sample"): void {
  try {
    // The demo and the logged-in app count separately, so doing both in one tab records both.
    const key = `pp_ev_${location.pathname.startsWith("/demo") ? "d" : "a"}_${event}_${source}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // storage blocked: send anyway
  }
  void fetch("/api/demo/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // The flow is where the visitor is, not whether they are logged in: a logged-in person can run the demo too.
    body: JSON.stringify({ event, source, session: sessionId(), flow: location.pathname.startsWith("/demo") ? "demo" : "app" }),
    keepalive: true,
  }).catch(() => {});
}
