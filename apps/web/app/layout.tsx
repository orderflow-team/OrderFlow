import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/sw-register";
import { AuthRedirectListener } from "@/components/auth-redirect-listener";
import { OtaUpdater } from "@/components/ota-updater";
import { DismissNativeSplash } from "@/components/splash-gif";
import { DEFAULT_DESCRIPTION, DEFAULT_IMAGE, DEFAULT_KEYWORDS, DEFAULT_OG_TITLE, DEFAULT_TITLE } from "@/lib/seo";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://obix360.com"),
  title: {
    default: DEFAULT_TITLE,
    template: "%s | OBIX 360",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: DEFAULT_KEYWORDS,
  authors: [{ name: "OBIX 360 Team", url: "https://obix360.com" }],
  creator: "OBIX 360",
  publisher: "OBIX 360",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://obix360.com",
    siteName: "OBIX 360",
    title: DEFAULT_OG_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [DEFAULT_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_OG_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OBIX 360",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" className="h-full antialiased selection:bg-emerald-500/30">
      <head>
        {/* Linked here (not @import-ed in the CSS) so the font stylesheet downloads in parallel with the app CSS. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <DismissNativeSplash />
        <SwRegister />
        <AuthRedirectListener />
        <OtaUpdater />
        {children}
      </body>
    </html>
  );
}
