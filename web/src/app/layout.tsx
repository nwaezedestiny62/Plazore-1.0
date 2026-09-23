import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { MarketplaceProvider } from "@/context/MarketplaceContext";
import { PrivacyConsent } from "@/components/privacy/PrivacyConsent";
import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  // optional: you can keep the weight array for Manrope or also remove it
  weight: ["300", "400", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  // REMOVE the weight array – Space Grotesk is variable
  // weight: ["500", "600"],   ← delete this line
});

export const metadata: Metadata = {
  title: "Plazore",
  description: "Discovery-driven. Intelligence-led commerce platform. Aimed at reducing the Information-Confidence Gap when it comes to purchasing and lisitngs products/goods online. Online shopping made easier, smarter and more efficient. Online selling that makes the merchants ask the right questiona and solving them with all supported tools and environment. Plazore is an insight-driven ecommerce platform.",
  icons: {
    icon: "/favicon.ico",           // → web/public/favicon.ico
    apple: "/favicon.ico", // → web/public/apple-touch-icon.png
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-bg text-text antialiased">
        <ClerkProvider>
          <MarketplaceProvider>
            <NetworkStatusBanner />
            {children}
            <PrivacyConsent />
          </MarketplaceProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}