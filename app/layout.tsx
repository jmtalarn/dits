import type { Metadata, Viewport } from "next";
import "./globals.css";


export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'Dits',
  description: 'A swipe-first, full-screen visual client for Bluesky.',
  manifest: '/dits/manifest.json',
  icons: {
    icon: '/dits/icon-192.png',
    apple: '/dits/icon-512.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dits',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ca">
      <body suppressHydrationWarning={true}>{children}</body>
    </html>
  );
}

