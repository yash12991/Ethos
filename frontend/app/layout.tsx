import type { Metadata } from "next";
import { Geist, Geist_Mono, Syne } from "next/font/google";
import "./globals.css";

import { Preloader } from "@/components/preloader";
import { AuthProvider } from "@/components/auth/auth-context";
import { ThemeSettingsProvider } from "@/components/theme-settings-provider";
import { ThemeToggle } from "@/components/theme-toggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  weight: ["700", "800"],
});

export const metadata: Metadata = {
  title: "ETHOS | Anonymous Workplace Reporting",
  description: "A safe, anonymous platform for workplace harassment reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${syne.variable} antialiased`}
      >
        <ThemeSettingsProvider>
          <AuthProvider>
            <Preloader>
              <ThemeToggle />
              {children}
            </Preloader>
          </AuthProvider>
        </ThemeSettingsProvider>
      </body>
    </html>
  );
}
