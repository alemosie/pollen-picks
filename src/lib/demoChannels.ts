// Sample channels for the public demo, so Write and Send can show how captions work without a Buffer account.
// They never reach Buffer: the demo's final send opens an account prompt instead of calling /api/draft.

export const DEMO_CHANNELS = [
  { id: "demo-instagram", name: "@justaphase_demo", service: "instagram" },
  { id: "demo-instagram-2", name: "@justaphase_events", service: "instagram" },
  { id: "demo-linkedin", name: "Just a Phase (sample page)", service: "linkedin" },
  { id: "demo-x", name: "@justaphase_demo", service: "twitter" },
];
