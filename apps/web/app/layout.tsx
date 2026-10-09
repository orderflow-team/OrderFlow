import type { Metadata, Viewport } from "next";
import { SwRegister } from "@/components/sw-register";
import { AuthRedirectListener } from "@/components/auth-redirect-listener";
import { OtaUpdater } from "@/components/ota-updater";
import { DismissNativeSplash } from "@/components/splash-gif";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://obix360.com"),
  title: {
    default: "OBIX 360 - All-in-One Billing Software | Orders, Inventory & POS",
    template: "%s | OBIX 360",
  },
  description:
    "OBIX 360 (Order Billing Inventory eXperience) — modern order management, automated billing, inventory tracking, WhatsApp notifications & POS for businesses.",
  keywords: [
    "OBIX",
    "OBIX 360",
    "obix360",
    "Orderflow",
    "Order Management",
    "All-in-One Billing Software",
    "Billing Software",
    "GST Billing Software",
    "Inventory Management",
    "WhatsApp Invoicing",
    "POS Billing",
    "Business Management Software",
  ],
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
    title: "OBIX 360 – GST Billing, Inventory & Orders in One App",
    description:
      "All-in-one billing software for India: GST invoicing, inventory, orders, POS and WhatsApp invoices for shops, pharmacies, wholesalers and restaurants.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "OBIX 360 – all-in-one GST billing, inventory and WhatsApp invoicing software",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OBIX 360 – GST Billing, Inventory & Orders in One App",
    description:
      "All-in-one billing software for India: GST invoicing, inventory, orders, POS and WhatsApp invoices for shops, pharmacies, wholesalers and restaurants.",
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
