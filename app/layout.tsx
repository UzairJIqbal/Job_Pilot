import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PostHogPageView } from "@/components/PostHogPageView";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "JobPilot",
  description: "AI-powered job search assistant for technical candidates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <PostHogPageView />
        {children}
      </body>
    </html>
  );
}
