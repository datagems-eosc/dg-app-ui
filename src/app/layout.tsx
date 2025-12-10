import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { UserProvider } from "@/contexts/UserContext";
import { getBasePath } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DataGEMS",
  description: "Dataset discovery and management ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const basePath = getBasePath();

  return (
    <html lang="en">
      <head>
        {/* Load runtime environment variables before React hydration */}
        <Script src={`${basePath}/__env.js`} strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProviderWrapper>
          <UserProvider>
            <DatasetProvider>
              <CollectionsProvider>{children}</CollectionsProvider>
            </DatasetProvider>
          </UserProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
