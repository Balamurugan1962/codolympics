import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Codolympics", template: "%s · Codolympics" },
  description: "Codolympics — the auction-based coding competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
