import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MJ-DOS | نظام التشغيل الرقمي - جرمان للوارد والصادر",
  description: "نظام التشغيل الرقمي",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
