import React, { useState, useRef, useEffect } from "react";
import { UploadCloud, Loader2, Image as ImageIcon, Link as LinkIcon, Check, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";

export interface ImageUploaderProps {
  onApplyImage?: (url: string) => void;
  onApplyThumbnail?: (url: string) => void;
  onAddMultiImage?: (url: string) => void;
}

export function ImageUploader({ onApplyImage, onApplyThumbnail, onAddMultiImage }: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const params = useParams();
  const guildId = params.guildId as string;

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        
        const res = await fetch(`/api/bot/guilds/${guildId}/upload_assets`, {
          method: "POST",
          body: formData,
        });
        
        if (!res.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }
        
        const data = await res.json();
        if (data.url) {
          newUrls.push(data.url);
        }
      }
      setUploadedUrls(prev => [...newUrls, ...prev]);
    } catch (err: any) {
      setError(err.message || "Failed to upload files");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    await uploadFiles(Array.from(e.target.files));
  };

  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData || !e.clipboardData.items) return;
      
      const files: File[] = [];
      for (const item of Array.from(e.clipboardData.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
      
      if (files.length > 0) {
        // Prevent default only if we found an image so we don't break normal text pasting
        // Actually, preventing default might block pasting an image into another input if they wanted to,
        // but since this is an image studio, uploading the pasted image automatically is great UX.
        await uploadFiles(files);
      }
    };

    window.addEventListener("paste", handleGlobalPaste);
    return () => window.removeEventListener("paste", handleGlobalPaste);
  }, [guildId]);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const removeUrl = async (urlToRemove: string) => {
    setUploadedUrls(prev => prev.filter(u => u !== urlToRemove));
    // Optional: could send a DELETE request to backend to physically clear storage if we add the endpoint.
    // Since images are fairly small, we can just detach them for now to fulfill the immediate UI need.
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#15161b] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-white">Asset Studio</h4>
          <p className="text-[11px] text-discord-text-muted mt-0.5">Bulk upload images locally to immediately use them in your embeds.</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="flex shrink-0 items-center gap-2 rounded border border-white/5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin text-[#5865F2]" /> : <UploadCloud className="h-4 w-4 text-[#5865F2]" />}
          Upload Images
        </button>
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </div>
      
      {error && <p className="text-xs text-red-500 bg-red-500/10 p-2 rounded">{error}</p>}
      
      {uploadedUrls.length > 0 && (
        <div className="flex gap-3 mt-2 border-t border-white/5 pt-3 overflow-x-auto pb-2 scrollbar-thin">
          {uploadedUrls.map((url, i) => (
            <div key={i} className="relative flex flex-col h-[160px] w-[160px] shrink-0 overflow-hidden rounded-lg bg-black/40 border border-white/5 group transition-colors hover:border-[#5865F2]/50 hover:bg-black/60">
              <div 
                className="h-full w-full shrink-0 bg-cover bg-center" 
                style={{ backgroundImage: `url(${url})` }}
              />
              
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 gap-2">
                <button
                  type="button"
                  title="Remove from Studio"
                  onClick={() => removeUrl(url)}
                  className="absolute top-1 right-1 rounded p-1 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition"
                >
                  <Trash2 className="h-3 w-3" />
                </button>

                <div className="flex flex-col gap-1.5 w-full mt-2">
                  <button
                    type="button"
                    onClick={() => onApplyThumbnail?.(url)}
                    className="w-full rounded bg-[#5865F2]/90 hover:bg-[#5865F2] px-2 py-1.5 text-[10px] font-bold text-white transition"
                  >
                    Set Thumb
                  </button>
                  <button
                    type="button"
                    onClick={() => onApplyImage?.(url)}
                    className="w-full rounded bg-[#5865F2]/90 hover:bg-[#5865F2] px-2 py-1.5 text-[10px] font-bold text-white transition"
                  >
                    Set Body
                  </button>
                  {onAddMultiImage && (
                    <button
                      type="button"
                      onClick={() => onAddMultiImage(url)}
                      className="w-full rounded bg-[#5865F2]/90 hover:bg-[#5865F2] px-2 py-1.5 text-[10px] font-bold text-white transition"
                    >
                      + Outside Embed
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
