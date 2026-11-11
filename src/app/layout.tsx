import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SIGNED_IN_HINT_SCRIPT } from "@/lib/signedInHint";

// Self-hosted (OFL) so the same files serve the app and the slide renderer.
const dmSans = localFont({
  variable: "--font-dm-sans",
  src: [
    { path: "../assets/fonts/DMSans-400.woff", weight: "400" },
    { path: "../assets/fonts/DMSans-500.woff", weight: "500" },
    { path: "../assets/fonts/DMSans-700.woff", weight: "700" },
  ],
});

const madimi = localFont({
  variable: "--font-madimi",
  src: [{ path: "../assets/fonts/MadimiOne-400.woff", weight: "400" }],
});

const TITLE = "Pollen Picks: Let your words travel";
const DESCRIPTION =
  "Your best writing, cross-pollinated to your socials. Pollen Picks turns newsletters and blog posts into carousel drafts via Buffer. No AI and free to use.";

export const metadata: Metadata = {
  // Makes the social preview image URL absolute. PUBLIC_BASE_URL overrides it (e.g. a tunnel); the deployed site is the default.
  metadataBase: new URL((process.env.PUBLIC_BASE_URL ?? "https://pollenpicks.netlify.app").replace(/\/$/, "")),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: "Pollen Picks", type: "website" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/opengraph-image"] },
};

// suppressHydrationWarning on <html>: the script in <head> may add data-in to it before React looks at it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${madimi.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SIGNED_IN_HINT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        {children}
      </body>
    </html>
  );
}
