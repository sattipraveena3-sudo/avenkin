import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Avenkin — Care stays close",
  description: "A calm, shared place for long-distance families to coordinate an aging parent's everyday care.",
  other: { "codex-preview": "development" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
