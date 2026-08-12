// Phase 7 — shared resume upload field (file upload + link fallback).
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cloudinaryConfigured, uploadResume } from "@/lib/resume-upload";
import { toast } from "sonner";
import { FileText, Loader2, Upload, X } from "lucide-react";

export function ResumeUpload({
  value,
  onChange,
  label = "Resume",
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadResume(file);
      onChange(url);
      setFileName(file.name);
      toast.success("Resume attached");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const attached = Boolean(value);
  const isInline = value.startsWith("data:");

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {uploading ? "Uploading…" : attached ? "Replace file" : "Upload file"}
        </Button>
        {attached && (
          <>
            {!isInline && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <a href={value} target="_blank" rel="noreferrer"><FileText className="size-4" /> Preview</a>
              </Button>
            )}
            <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setFileName(null); }}>
              <X className="size-4" /> Remove
            </Button>
          </>
        )}
      </div>
      {attached && (
        <p className="text-xs text-muted-foreground">
          {fileName ?? (isInline ? "Attached file" : value)}
        </p>
      )}
      <Input
        value={isInline ? "" : value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="…or paste a shareable link (Google Drive, Dropbox)"
      />
      <p className="text-xs text-muted-foreground">
        PDF or Word. {cloudinaryConfigured() ? "Files are stored on hosted file storage." : "Without hosted storage configured, files must be under 700 KB."}
      </p>
    </div>
  );
}
