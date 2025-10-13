// app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import BottomBar from "@/components/BottomBar";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "OpenVerse",
  description: "Community web novel platform",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // untuk safe-area notch iOS
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable} suppressHydrationWarning>
      <body
        // font fallback + base colors agar konsisten
        className="min-h-screen bg-zinc-950 text-zinc-100 antialiased"
        style={{ fontFamily: "var(--font-poppins), system-ui, -apple-system, Segoe UI, Roboto" }}
      >
        {/* Konten halaman */}
        {children}

        {/* BottomBar global — hanya dipasang sekali di layout */}
        <BottomBar />
      </body>
    </html>
  );
}
