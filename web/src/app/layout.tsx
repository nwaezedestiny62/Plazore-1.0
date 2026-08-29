import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { MarketplaceProvider } from "@/context/MarketplaceContext";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["300", "400", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  weight: ["500", "600"],
});

export const metadata: Metadata = {
  title: "Plazore",
  description: "A quieter way to discover what matters.",
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
          <MarketplaceProvider>{children}</MarketplaceProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}