import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Cocoro OS',
  description: 'あなただけのAI人格OS',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Cocoro',
  },
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
    apple: '/favicon.svg',
  },
};

// ── Inline scripts that must run BEFORE first paint ────────────
// 1. Theme: read localStorage and set data-theme to prevent flash
// 2. SW: register service worker for offline support
const themeScript = `(function(){
  try {
    var s = localStorage.getItem('cocoro_settings');
    var t = s ? JSON.parse(s).theme : 'system';
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme','dark');
    } else if (t === 'light') {
      document.documentElement.setAttribute('data-theme','light');
    } else {
      // 'system' — follow OS preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme','dark');
      }
    }
  } catch(e) {}
})();`;

const swScript = `(function(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').catch(function(){});
    });
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        {/* Theme init — must be synchronous to prevent FOUC */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* PWA */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ff69b4" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* Service Worker registration */}
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
