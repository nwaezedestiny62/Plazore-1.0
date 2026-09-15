import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { NetworkStatusBanner } from "@/components/network/NetworkStatusBanner";

export const metadata: Metadata = {
  title: "Plazore Admin",
  description: "Plazore operational control center",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0d11] text-white antialiased">
        <ClerkProvider>
          <NetworkStatusBanner />
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}