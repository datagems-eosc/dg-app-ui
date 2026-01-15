import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { UserProvider } from "@/contexts/UserContext";

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
        <ErrorBoundary>
          <SessionProviderWrapper>
            <ErrorProvider>
              <UserProvider>
                <DatasetProvider>
                  <CollectionsProvider>{children}</CollectionsProvider>
                </DatasetProvider>
              </UserProvider>
            </ErrorProvider>
          </SessionProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
