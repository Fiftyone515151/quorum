import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import HeaderNav from "@/components/HeaderNav";

export const metadata: Metadata = {
  title: "Quorum",
  description: "Assemble a VC panel to weigh in on your startup.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl">⚖️</span>
              <span className="font-mono text-lg font-semibold tracking-tight text-white">Quorum</span>
            </Link>
            <HeaderNav authed={!!session} />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
