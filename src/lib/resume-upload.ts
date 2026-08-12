// Phase 7 — resume file storage.
// Firebase Storage needs a paid Blaze plan, so uploads go to Cloudinary
// (free, unsigned upload preset) when configured, and otherwise fall back to a
// base64 data URL stored on the candidate document in Firestore.

export const MAX_RESUME_BYTES = 700 * 1024; // Firestore doc limit is 1 MiB
export const ACCEPTED_RESUME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string | undefined;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string | undefined;

export function cloudinaryConfigured(): boolean {
  return Boolean(CLOUD_NAME && UPLOAD_PRESET);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

export function validateResume(file: File): void {
  const okType =
    ACCEPTED_RESUME_TYPES.includes(file.type) || /\.(pdf|docx?)$/i.test(file.name);
  if (!okType) throw new Error("Resume must be a PDF or Word document");
  if (!cloudinaryConfigured() && file.size > MAX_RESUME_BYTES) {
    throw new Error("File is larger than 700 KB — compress it or paste a shareable link instead");
  }
  if (file.size > 10 * 1024 * 1024) throw new Error("File is larger than 10 MB");
}

/** Uploads a resume and returns a URL (hosted URL or inline data URL). */
export async function uploadResume(file: File): Promise<string> {
  validateResume(file);

  if (cloudinaryConfigured()) {
    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", UPLOAD_PRESET!);
    body.append("folder", "talentflow/resumes");
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`, {
      method: "POST",
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}). ${text.slice(0, 160)}`);
    }
    const json = (await res.json()) as { secure_url?: string };
    if (!json.secure_url) throw new Error("Upload succeeded but no file URL was returned");
    return json.secure_url;
  }

  return readAsDataUrl(file);
}
