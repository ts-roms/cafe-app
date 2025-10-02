import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import React from "react";
import NavBar from "@/components/NavBar";
import MirageBoot from "@/mirage/Boot";

export const metadata: Metadata = {
  title: "Cafe App",
  description: "POS, Accounting, and Time tracker with RBAC (demo)",
};

export default function RootLayout({ children }: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <MirageBoot />
          <NavBar />
          <main className="max-w-5xl mx-auto p-4">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
