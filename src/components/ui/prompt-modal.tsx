"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PromptModalProps {
  open: boolean;
  title: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  open,
  title,
  label,
  placeholder = "",
  defaultValue = "",
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      // Focus after transition
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, defaultValue]);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  };

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      {/* Modal card */}
      <div
        className="w-full max-w-sm rounded-2xl border border-[#3d3f45] shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #2b2d31 0%, #232428 100%)",
          animation: "promptIn 0.18s cubic-bezier(0.34,1.56,0.64,1)",
        }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-[#1e1f22]">
          <h2 className="text-base font-bold text-white">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-3">
          {label && (
            <label className="text-xs font-semibold text-discord-text-muted uppercase tracking-wider">
              {label}
            </label>
          )}
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="bg-[#1e1f22] border-[#3d3f45] text-white placeholder:text-discord-text-muted focus:border-discord-blurple focus:ring-1 focus:ring-discord-blurple/40 rounded-lg"
          />
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onCancel}
            className="text-discord-text-muted hover:text-white hover:bg-white/5"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="bg-discord-blurple hover:bg-discord-blurple/80 text-white font-semibold"
          >
            Confirm
          </Button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes promptIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
