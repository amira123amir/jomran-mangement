import type { Metadata } from "next";
import { cairo, inter, jetbrainsMono } from "../lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "MJ-DOS | نظام التشغيل الرقمي - جرمان للوارد والصادر",
  description:
    "نظام التشغيل الرقمي لإدارة عمليات الاستيراد والتصدير — جرمان للوارد والصادر. يشمل إدارة الطلبات، التسعير، المشتريات، المحاسبة، وسير العمل.",
  keywords: ["MJ-DOS", "نظام إدارة", "استيراد", "تصدير", "جرمان", "تسعير", "مشتريات"],
  authors: [{ name: "MJ Group" }],
  openGraph: {
    title: "MJ-DOS | نظام التشغيل الرقمي",
    description: "نظام التشغيل الرقمي لإدارة عمليات الاستيراد والتصدير",
    type: "website",
    locale: "ar_SA",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${cairo.variable} ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
