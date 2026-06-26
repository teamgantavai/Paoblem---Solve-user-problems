import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next"
import TopLoader from "@/components/TopLoader";
import GSAPAnimations from '@/components/GSAPAnimations';
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: {
    default: "Paoblem - Startup Problems, Ideas & Solutions Network",
    template: "%s | Paoblem"
  },
  description: "Share real startup problems, validate startup ideas, collaborate on solutions, and discover next-generation business opportunities on Paoblem (Problem) - the social platform for founders.",
  keywords: ["paoblem", "problem", "startup problems", "business ideas", "founder network", "startup solutions", "validate ideas", "entrepreneur community"],
  creator: "Dilkhush Jha",
  authors: [{ name: "Dilkhush Jha" }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://paoblem.com'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light-theme');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7327874048799522"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          <Suspense fallback={null}>
            <TopLoader />
          </Suspense>
          <GSAPAnimations />
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
