import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";
import "./globals.css";
import Providers from "./providers";
import { Analytics } from "@vercel/analytics/next"
import TopLoader from "@/components/TopLoader";

export const metadata: Metadata = {
  title: "Paoblem - Social network for founders",
  description: "Share your problems and find solutions",
};

import GSAPAnimations from '@/components/GSAPAnimations';

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
      </body>
    </html>
  );
}

