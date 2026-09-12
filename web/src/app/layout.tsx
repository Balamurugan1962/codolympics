import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contest",
  description: "Auction-based coding competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
