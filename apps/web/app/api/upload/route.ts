import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  // Require a session — file parsing is CPU-heavy and shouldn't be open to anonymous callers.
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 15 MB)." }, { status: 400 });
  }

  const name = file.name || "upload";
  const ext = name.toLowerCase().split(".").pop() ?? "";
  const ab = await file.arrayBuffer();

  let content = "";
  try {
    if (ext === "pdf") {
      const { getDocumentProxy, extractText } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(ab));
      const res = await extractText(pdf, { mergePages: true });
      content = Array.isArray(res.text) ? res.text.join("\n") : res.text;
    } else if (ext === "docx") {
      const mammoth = (await import("mammoth")).default;
      const res = await mammoth.extractRawText({ buffer: Buffer.from(ab) });
      content = res.value;
    } else if (["txt", "md", "markdown", "csv", "json", "rtf", "log"].includes(ext)) {
      content = new TextDecoder().decode(ab);
    } else {
      return NextResponse.json(
        { error: `Unsupported file type ".${ext}". Use PDF, DOCX, TXT, MD, or CSV.` },
        { status: 415 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `Could not read that file: ${(e as Error).message}` },
      { status: 422 }
    );
  }

  content = content.trim();
  if (!content) {
    return NextResponse.json(
      { error: "No text could be extracted (is it a scanned image PDF?)." },
      { status: 422 }
    );
  }

  return NextResponse.json({ name, content, chars: content.length });
}
