import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RatesProvider } from "@/components/RatesProvider";
import { hasSharedStore, loadStore } from "@/lib/store/rates-store";
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
  title: "UK → Sri Lanka remittance rates",
  description:
    "Live GBP to LKR remittance heatmap. RemitWire (BOC UK) effective rates by send amount.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f4f5",
};

/** Hobby plans allow one function region. London is closest to this UK corridor. */
export const preferredRegion = "lhr1";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const initialState = await loadStore();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="min-h-dvh bg-zinc-100 font-sans text-zinc-900">
        <RatesProvider
          initialState={initialState}
          sharedStore={hasSharedStore()}
        >
          {children}
        </RatesProvider>
      </body>
    </html>
  );
}
