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
  description: "A discovery-driven commerce platform designed to make buying and selling online feel more natural. Plazore combines immersive product discovery, intelligent insights, and a structured shopping environment to reduce uncertainty between finding a product and confidently purchasing it. For sellers, Plazore provides the tools and insights to present, manage, and grow their products with greater clarity. Plazore is commerce built around discovery, insight, and confidence.",
  icons: {
    icon: "/favicon.png",           // → web/public/favicon.ico
    apple: "/favicon.png", // → web/public/apple-touch-icon.png
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