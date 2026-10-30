import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

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

export const metadata: Metadata = {
  title: "Pollen Picks",
  description: "From picks to posts: top content from Beehiiv, to Buffer, and beyond.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${dmSans.variable} ${madimi.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
