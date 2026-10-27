import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { MidtransScript } from "@/modules/billing/snap-script";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/env";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SaaS Starter Kit — Production-Ready Next.js & Better Auth Template",
    template: "%s | SaaS Starter Kit",
  },
  description:
    "Modular monolith SaaS template repository featuring Next.js App Router, Better Auth, Drizzle ORM, PostgreSQL, and Midtrans payment gateway.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="top-right" richColors />
          <MidtransScript isProduction={env.MIDTRANS_IS_PRODUCTION} />
        </ThemeProvider>
      </body>
    </html>
  );
}
