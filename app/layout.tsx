import "./globals.css";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400","600","700"],
  variable: "--font-poppins",
});

export const metadata = {
  title: "OpenVerse",
  description: "Community web novel platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={poppins.variable} suppressHydrationWarning>
      <body style={{ fontFamily: "var(--font-poppins), system-ui, -apple-system, Segoe UI, Roboto" }}>
        {children}
      </body>
    </html>
  );
}
