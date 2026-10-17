// Shared by the upload form and the uploadResume server action.

// The file travels in a Server Action body. Vercel rejects request bodies over
// 4.5MB, and next.config.ts raises Next's own 1MB default to fit, so 4MB leaves
// room for the multipart overhead.
export const MAX_RESUME_BYTES = 4 * 1024 * 1024;
export const MAX_RESUME_LABEL = "4MB";
