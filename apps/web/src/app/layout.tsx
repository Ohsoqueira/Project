import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ServiceBox",
  description: "Field service management for commercial service contractors.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
