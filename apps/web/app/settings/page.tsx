import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  if (!(await getSession())) redirect("/login");
  return (
    <div className="min-h-screen bg-white px-6 py-6 font-sans text-navy">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-medium text-navy/60 transition hover:text-brand">← Home</Link>
        <h1 className="mt-6"><span className="font-pixel text-lg leading-[1.7] text-brand">Settings</span></h1>
        <p className="mt-4 text-sm leading-relaxed text-navy/60">
          Account settings and deleted-meeting recovery are coming soon.
        </p>
      </div>
    </div>
  );
}
