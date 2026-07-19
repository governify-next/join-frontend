import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Join Governify",
  description: "Onboard projects into the Governify ecosystem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
