import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { extractFileText } from "@/lib/extractText";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Require a session — file parsing is CPU-heavy and shouldn't be open to anonymous callers.
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

  const res = await extractFileText(file);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ name: res.name, content: res.content, chars: res.content.length });
}
