import type { Metadata } from "next";

import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Codolympics", template: "%s · Codolympics" },
  description: "Codolympics: the auction-based coding competition",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* One provider for the whole app; 300ms so a tooltip is intent, not a twitch. */}
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </body>
    </html>
  );
}
