"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function HeaderNav({ authed }: { authed: boolean }) {
  const router = useRouter();
  if (!authed) return <Link href="/login" className="btn-ghost">Sign in</Link>;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/history" className="btn-ghost">History</Link>
      <button onClick={logout} className="btn-ghost">Sign out</button>
    </div>
  );
}
