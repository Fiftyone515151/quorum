import Link from "next/link";
import HeaderNav from "@/components/HeaderNav";

/** Dark app chrome (header + centered main) for the internal pages that still
 *  use the utility theme. The home + onboarding paint their own light UI, so
 *  they render outside this shell. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
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
  );
}
