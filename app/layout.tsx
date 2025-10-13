// app/(site)/layout.tsx
import "../globals.css";
import { Poppins } from "next/font/google";
import BottomBar from "@/components/BottomBar";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "Gachaverse",
  description: "Community web novel platform",
};

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={poppins.variable} suppressHydrationWarning>
      {/* NOTE:
         - BottomBar-mu sudah punya spacer sendiri, jadi di sini
           TIDAK perlu tambah <div className="h-[68px]"/> lagi.
      */}
      <body
        style={{
          fontFamily:
            "var(--font-poppins), system-ui, -apple-system, Segoe UI, Roboto",
        }}
      >
        {children}
        <BottomBar />
      </body>
    </html>
  );
}
