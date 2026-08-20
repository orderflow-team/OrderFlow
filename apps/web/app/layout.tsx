import type { Metadata, Viewport } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { SwRegister } from "@/components/sw-register";
import { AuthRedirectListener } from "@/components/auth-redirect-listener";
import { OtaUpdater } from "@/components/ota-updater";
import { SplashVideo } from "@/components/splash-video";
import "./globals.css";

const sans = Inter({
  variable: "--font-sans-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OBIX - Business. Simplified.",
  description: "Order Billing Inventory eXperience — multi-industry order management, billing, inventory & POS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OBIX",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#059669",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${geistMono.variable} h-full antialiased selection:bg-emerald-500/30`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <SplashVideo />
        <SwRegister />
        <AuthRedirectListener />
        <OtaUpdater />
        {children}
      </body>
    </html>
  );
}
