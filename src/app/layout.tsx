import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AfbudsMotor — Fyld afbudstider automatisk via SMS",
  description:
    "Kalenderuafhængig afbudsmotor til danske klinikker. Fyld sene afbud på få minutter via automatisk SMS-venteliste uden CPR eller kliniske data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="da">
      <body className="min-h-screen bg-[#f6f8f9] text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
