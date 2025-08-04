import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { UserProvider } from "@/contexts/UserContext";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";

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
  return (
    <html lang="en">
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
