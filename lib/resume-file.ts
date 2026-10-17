// Shared by the upload form and the uploadResume server action.

// The file travels in a Server Action body. Vercel rejects request bodies over
// 4.5MB, and next.config.ts raises Next's own 1MB default to fit, so 4MB leaves
// room for the multipart overhead.
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
export const MAX_RESUME_LABEL = "4MB";

// A browser trusts the file extension for `type`, so a renamed text file arrives
// as application/pdf. Real PDFs carry "%PDF-" near the start (readers accept it
// anywhere in the first 1KB).
const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-

export const NOT_A_PDF = "This file isn't a valid PDF. Export your resume as a PDF and try again.";

export function looksLikePdf(head: Uint8Array): boolean {
  const end = Math.min(head.length, 1024) - PDF_MAGIC.length;
  for (let i = 0; i <= end; i++) {
    if (PDF_MAGIC.every((b, j) => head[i + j] === b)) return true;
  }
  return false;
}
