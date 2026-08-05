// Shared file-text extraction (PDF / DOCX / plain text), used by /api/upload
// and /api/documents. Node runtime only (dynamic-imports native parsers).
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

export type ExtractResult =
  | { ok: true; name: string; ext: string; content: string }
  | { ok: false; status: number; error: string };

export async function extractFileText(file: File): Promise<ExtractResult> {
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, status: 400, error: "File too large (max 15 MB)." };

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
      return { ok: false, status: 415, error: `Unsupported file type ".${ext}". Use PDF, DOCX, TXT, MD, or CSV.` };
    }
  } catch (e) {
    return { ok: false, status: 422, error: `Could not read that file: ${(e as Error).message}` };
  }

  content = content.trim();
  if (!content) return { ok: false, status: 422, error: "No text could be extracted (is it a scanned image PDF?)." };
  return { ok: true, name, ext, content };
}
