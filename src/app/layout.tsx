import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
import { CollectionsProvider } from "@/contexts/CollectionsContext";
import { DatasetProvider } from "@/contexts/DatasetContext";
import { ErrorProvider } from "@/contexts/ErrorContext";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { UserProvider } from "@/contexts/UserContext";
import { getAppVersion } from "@/lib/appVersion";

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
  const appVersion = getAppVersion();
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <html lang="en">
      <head>
        <Script src={`${basePath}/__env.js`} strategy="beforeInteractive" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ErrorBoundary>
          <SessionProviderWrapper>
            <ErrorProvider>
              <UserProvider>
                <DatasetProvider>
                  <CollectionsProvider>
                    <FeatureFlagsProvider>
                      {children}
                      {appVersion ? (
                        <div className="fixed bottom-3 right-4 text-[10px] leading-[150%] text-gray-650 tracking-[0.12px]">
                          {appVersion}
                        </div>
                      ) : null}
                    </FeatureFlagsProvider>
                  </CollectionsProvider>
                </DatasetProvider>
              </UserProvider>
            </ErrorProvider>
          </SessionProviderWrapper>
        </ErrorBoundary>
      </body>
    </html>
  );
}
