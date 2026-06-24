import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import { Providers } from "@/components/layout/providers";

import "./globals.css";

const nunitoSans = Nunito_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800"],
  display: "swap",
});

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
      <body className={nunitoSans.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
