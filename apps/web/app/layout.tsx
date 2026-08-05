import "./globals.css";
import type { Metadata } from "next";
import { Inter, Press_Start_2P } from "next/font/google";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const pixel = Press_Start_2P({ subsets: ["latin"], weight: "400", variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "Quorum",
  description: "A simulated VC panel that pressure-tests your startup.",
};

// The root layout only wires fonts. Each page owns its chrome: internal utility
// pages wrap themselves in <AppShell> (dark), while the home, onboarding, login
// and landing paint their own light, full-bleed UI.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
