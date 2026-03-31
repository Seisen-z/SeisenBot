"use client";

import { useState, useEffect } from "react";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { DiscordMessagePreview } from "./discord-message";

export interface EmbedConfig {
  content?: string;
  title?: string;
  description?: string;
  color?: string | number;
  thumbnail_url?: string;
  footer?: string;
  [key: string]: any; // Allow other properties
}

export function AdvancedEmbedEditor({
  config,
  onChange,
  children,
  bottomChildren
}: {
  config: EmbedConfig;
  onChange: (key: string, val: any) => void;
  children?: React.ReactNode;
  bottomChildren?: React.ReactNode;
}) {
  const [tab, setTab] = useState<"visual" | "raw" | "preview">("visual");
  const [rawText, setRawText] = useState("");

  useEffect(() => {
    if (tab === "raw") {
      let numericalColor = null;
      if (typeof config.color === "string" && config.color.startsWith("#")) {
        numericalColor = parseInt(config.color.replace("#", ""), 16);
      } else if (config.color) {
        numericalColor = parseInt(String(config.color)) || null;
      }

      const payload = {
        content: config.content || null,
        embeds: [{
          title: config.title || null,
          description: config.description || null,
          color: numericalColor,
          thumbnail: config.thumbnail_url ? { url: config.thumbnail_url } : null,
          footer: config.footer ? { text: config.footer } : null
        }]
      };
      setRawText(JSON.stringify(payload, null, 2));
    }
  }, [tab, config.content, config.title, config.description, config.color, config.thumbnail_url, config.footer]);

  const handleRawChange = (val: string) => {
    setRawText(val);
    try {
      const parsed = JSON.parse(val);
      onChange("content", parsed.content || "");
      if (parsed.embeds && parsed.embeds.length > 0) {
        const em = parsed.embeds[0];
        onChange("title", em.title || "");
        onChange("description", em.description || "");
        if (em.color) {
            onChange("color", em.color);
        }
        onChange("thumbnail_url", em.thumbnail?.url || "");
        onChange("footer", em.footer?.text || "");
      }
    } catch (e) {
      // Syntax error while typing, ignore state update
    }
  };

  return (
    <div className="flex flex-col">
      {/* Top Navigation */}
      <div className="flex border-b border-[#1E1F22] rounded-t-xl overflow-hidden bg-[#1E1F22]">
        {["visual", "raw", "preview"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 py-3 text-[13px] tracking-wide font-bold uppercase transition ${tab === t ? 'bg-[#2B2D31] text-discord-blurple border-t-2 border-discord-blurple shadow-sm' : 'bg-[#2B2D31] hover:bg-[#313338] text-discord-text-muted border-t-2 border-transparent'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-[#2B2D31] rounded-b-xl border border-t-0 border-[#1E1F22] p-6 shadow-sm min-h-[450px]">
        {tab === "visual" && (
          <div className="flex flex-col gap-5">
            {children}
            <div>
              <label className="mb-2 block text-sm font-medium text-discord-text-muted">Message Content / Outside Text</label>
              <Input
                value={config.content || ""}
                onChange={(e) => onChange("content", e.target.value)}
                placeholder="Text printed above the embed... (e.g. pinging everyone)"
              />
            </div>

            <div className="mt-2 pt-4 border-t border-[#1E1F22]">
              <h3 className="mb-4 text-sm font-bold text-discord-text-muted uppercase tracking-wide">Embed Configuration</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Embed Title</label>
                  <Input value={config.title || ""} onChange={(e) => onChange("title", e.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Description</label>
                  <Textarea className="h-40 font-mono text-sm" value={config.description || ""} onChange={(e) => onChange("description", e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Embed Color</label>
                    <div className="flex items-center gap-3">
                      <Input value={config.color || ""} placeholder="#5865F2 or Decimal" onChange={(e) => onChange("color", e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Thumbnail URL</label>
                    <Input value={config.thumbnail_url || ""} placeholder="https://..." onChange={(e) => onChange("thumbnail_url", e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-discord-text-muted">Footer Text</label>
                  <Input value={config.footer || ""} onChange={(e) => onChange("footer", e.target.value)} />
                </div>
              </div>
            </div>

            {bottomChildren}
          </div>
        )}

        {tab === "raw" && (
          <div className="flex flex-col h-full space-y-3">
            <div>
              <h4 className="text-white text-md font-bold">Raw JSON Source</h4>
              <p className="text-xs text-discord-text-muted">Paste JSON exported from Discohook, Sapphire, or Carl-bot. The visual editor will update automatically.</p>
            </div>
            <Textarea
              className="flex-1 font-mono text-[13px] bg-[#1E1F22] border-[#111214] min-h-[400px] leading-relaxed text-[#DBDEE1]"
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder="{...}"
              spellCheck={false}
            />
          </div>
        )}

        {tab === "preview" && (
          <div className="flex justify-center items-start bg-[url('https://discord.com/assets/2f9c5603f7eeb883b632.svg')] bg-[#313338] p-8 rounded border border-[#1E1F22] shadow-inner min-h-[400px]">
            <div className="w-full max-w-[500px]">
              <DiscordMessagePreview
                botName="Seisen Bot"
                timestamp="Today at 12:00 PM"
                content={config.content}
                title={config.title}
                description={config.description || "Your custom embed description will appear here."}
                color={config.color}
                thumbnailUrl={config.thumbnail_url}
                footerText={config.footer}
                buttons={config.buttons}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
