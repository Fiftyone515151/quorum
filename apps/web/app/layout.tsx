import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Press_Start_2P } from "next/font/google";
import { getSession } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "Quorum",
  description: "A simulated VC panel that pressure-tests your startup.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en" className={`${sans.variable} ${pixel.variable}`}>
      <body>
        {/* The dark app chrome only shows once signed in. Public pages (landing,
            login) render full-bleed and paint their own light theme. */}
        {session ? (
          <>
            <header className="border-b border-line">
              <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
                <Link href="/" className="flex items-center gap-2">
                  <span className="text-xl">⚖️</span>
                  <span className="font-mono text-lg font-semibold tracking-tight text-white">Quorum</span>
                </Link>
                <HeaderNav authed={true} />
              </div>
            </header>
            <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
          </>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
