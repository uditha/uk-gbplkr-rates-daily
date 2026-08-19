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
  title: "UK → Sri Lanka remittance rates",
  description:
    "Live GBP to LKR remittance heatmap. RemitWire (BOC UK) effective rates by send amount.",
};

/** Hobby plans allow one function region. London is closest to this UK corridor. */
export const preferredRegion = "lhr1";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: "light" }}
    >
      <body className="h-full bg-zinc-100 font-sans text-zinc-900">
        {children}
      </body>
    </html>
  );
}
