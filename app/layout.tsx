import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creditable — Partner Dashboard",
  description:
    "Reservations and performance analytics for Creditable partner restaurants.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
