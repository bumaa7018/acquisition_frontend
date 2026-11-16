import type { Metadata } from "next";
import { Providers } from "@/components/layout/providers";

// Self-hosted фонтууд (Nunito Sans + «Он цагийн зураг»-ын фонтууд) — fonts.css-ийн толгойг үз.
import "./fonts.css";
import "./globals.css";
import "@/components/ui/status-label.css";

export const metadata: Metadata = {
  title: "Газрын Мэдээллийн Систем",
  description: "Газар чөлөөлөлтийн удирдлагын систем",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body className="font-nunito-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
