import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "School Manager", template: "%s" },
  description: "School management for students, attendance, fees and guardians",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "School" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#17356B" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1527" },
  ],
};

// Runs before paint: language from cookie, theme from cookie/device. No data, no secrets.
const boot = `(function(){try{var c=document.cookie;var l=/(?:^|; )bls_locale=(bn|en)/.exec(c);
document.documentElement.lang=l?l[1]:'bn';var t=/(?:^|; )bls_theme=(light|dark|system)/.exec(c);t=t?t[1]:'system';
if(t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark');}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: boot }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
