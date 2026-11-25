import type { Metadata, Viewport } from "next";
import { Geist_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Church Bot",
  description: "Edit what the church's WhatsApp bot says, run event sign-ups and read requests.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  // The browser chrome takes the canvas colour, so the glass bar has no seam above it.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  // Lets the page run under the notch; the tab bar pads itself back out.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // next-themes sets the class before React hydrates, so the attribute differs by design.
    <html lang="en" className={`${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
          {/* Top, so a toast never lands under the phone's tab bar. */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
