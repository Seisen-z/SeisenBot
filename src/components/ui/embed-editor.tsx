"use client";

import { useState, useEffect, useRef } from "react";
import { UploadIcon } from "lucide-react";
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
  const [rawError, setRawError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const hasConfigKey = (key: string) => Object.prototype.hasOwnProperty.call(config, key);

  const normalizeDescription = (description: unknown) => {
    if (Array.isArray(description)) {
      return description.join("\n");
    }
    return typeof description === "string" ? description : "";
  };

  const applyParsedPayload = (parsed: any) => {
    let payload = parsed;

    if (
      parsed &&
      typeof parsed === "object" &&
      !Array.isArray(parsed.embeds) &&
      (parsed.title !== undefined ||
        parsed.description !== undefined ||
        parsed.color !== undefined ||
        parsed.thumbnail !== undefined ||
        parsed.footer !== undefined)
    ) {
      payload = {
        content: parsed.content ?? "",
        embeds: [parsed],
        components: parsed.components ?? [],
      };
    }

    if (payload?.content !== undefined) {
      onChange("content", payload.content || "");
    }

    const em = Array.isArray(payload?.embeds) && payload.embeds.length > 0 ? payload.embeds[0] : null;

    if (em) {
      onChange("title", em.title || "");
      onChange("description", normalizeDescription(em.description));

      if (em.color !== undefined && em.color !== null) {
        onChange("color", em.color);
      }

      const thumbnailUrl = em.thumbnail?.url ?? em.thumbnail_url ?? "";
      onChange("thumbnail_url", thumbnailUrl);

      const footerText = typeof em.footer === "string" ? em.footer : em.footer?.text || "";
      onChange("footer", footerText);
    }

    if (Array.isArray(payload?.components)) {
      if (hasConfigKey("components")) {
        onChange("components", payload.components);
      }

      const componentList = payload.components.flatMap((row: any) =>
        Array.isArray(row?.components) ? row.components : []
      );

      const selectComponent = componentList.find((component: any) => component?.type === 3);
      if (selectComponent) {
        if (hasConfigKey("placeholder")) {
          onChange("placeholder", selectComponent.placeholder || "Choose options...");
        }

        if (hasConfigKey("min_values")) {
          onChange("min_values", Number(selectComponent.min_values ?? 1));
        }

        if (hasConfigKey("max_values")) {
          onChange("max_values", Number(selectComponent.max_values ?? 1));
        }

        if (hasConfigKey("options") && Array.isArray(selectComponent.options)) {
          const mappedOptions = selectComponent.options.map((option: any) => ({
            label: String(option.label || "Option"),
            value: String(option.value || ""),
            description: String(option.description || ""),
            emoji:
              typeof option.emoji === "string"
                ? option.emoji
                : option.emoji?.name || undefined,
          }));

          onChange("options", mappedOptions);
        }
      }

      const linkButtons = componentList.filter(
        (component: any) => component?.type === 2 && component?.style === 5 && component?.url
      );

      if (hasConfigKey("buttons") && linkButtons.length > 0) {
        onChange(
          "buttons",
          linkButtons.slice(0, 5).map((button: any) => ({
            label: String(button.label || "Button"),
            url: String(button.url || ""),
          }))
        );
      }
    }
  };

  const handleTemplateFileUpload = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      const fileText = typeof reader.result === "string" ? reader.result : "";
      handleRawChange(fileText);
    };

    reader.onerror = () => {
      setRawError("Failed to read the selected file.");
    };

    reader.readAsText(file);
    event.target.value = "";
  };

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
        }],
        components: config.components || undefined,
      };

      if (!payload.components && hasConfigKey("options") && Array.isArray(config.options)) {
        payload.components = [
          {
            type: 1,
            components: [
              {
                type: 3,
                custom_id: "imported_select",
                placeholder: config.placeholder || "Choose options...",
                min_values: Number(config.min_values ?? 1),
                max_values: Number(config.max_values ?? 1),
                options: config.options.map((option: any) => ({
                  label: option.label,
                  value: option.value,
                  description: option.description,
                  emoji: option.emoji,
                  default: false,
                })),
              },
            ],
          },
        ];
      }

      setRawText(JSON.stringify(payload, null, 2));
      setRawError(null);
    }
  }, [
    tab,
    config.content,
    config.title,
    config.description,
    config.color,
    config.thumbnail_url,
    config.footer,
    config.components,
    config.placeholder,
    config.min_values,
    config.max_values,
    config.options,
  ]);

  const handleRawChange = (val: string) => {
    setRawText(val);

    if (!val.trim()) {
      setRawError(null);
      return;
    }

    try {
      const parsed = JSON.parse(val);
      setRawError(null);
      applyParsedPayload(parsed);
    } catch {
      setRawError("Invalid JSON format. Fix the syntax and it will auto-apply.");
    }
  };

  return (
    <div className="flex flex-col">
      {/* Top Navigation */}
      <div className="flex overflow-hidden rounded-t-2xl border border-white/12 border-b-0 bg-[#121317]">
        {["visual", "raw", "preview"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t as any)}
            className={`flex-1 border-t-2 py-3 text-[12px] font-bold uppercase tracking-[0.14em] transition ${tab === t ? 'border-white/40 bg-[#1b1c22] text-white' : 'border-transparent bg-[#14151a] text-discord-text-muted hover:bg-[#1c1d24] hover:text-white'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="glass-card min-h-[450px] rounded-b-2xl border border-t-0 border-white/12 bg-[linear-gradient(165deg,rgba(24,24,27,0.92),rgba(16,16,18,0.94))] p-6">
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
                      <Input value={config.color || ""} placeholder="#A3A7B0 or Decimal" onChange={(e) => onChange("color", e.target.value)} />
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-white text-md font-bold">Raw JSON Source</h4>
                <p className="text-xs text-discord-text-muted">Paste or upload JSON exported from Discohook, Sapphire, or Carl-bot. This template applies automatically across supported modules.</p>
              </div>

              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json,text/plain"
                  className="hidden"
                  onChange={handleTemplateFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-[#1b1d22] px-3 text-xs font-semibold uppercase tracking-[0.1em] text-discord-text transition hover:border-white/35 hover:bg-[#252831]"
                >
                  <UploadIcon className="h-3.5 w-3.5" />
                  Upload JSON
                </button>
              </div>
            </div>

            {rawError && <p className="text-xs text-discord-red">{rawError}</p>}

            <Textarea
              className="min-h-[400px] flex-1 border-white/10 bg-[#111216] font-mono text-[13px] leading-relaxed text-[#DBDEE1]"
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder="{...}"
              spellCheck={false}
            />
          </div>
        )}

        {tab === "preview" && (
          <div className="min-h-[400px] rounded-xl border border-white/12 bg-[#101116] p-8 shadow-inner">
            <div className="w-full max-w-[500px]">
              <DiscordMessagePreview
                message={{
                  content: config.content,
                  embeds: [{
                    title: config.title,
                    description: config.description,
                    color: typeof config.color === "string" && config.color.startsWith("#") 
                      ? parseInt(config.color.replace("#", ""), 16) 
                      : parseInt(String(config.color)) || 5814783,
                    thumbnail: config.thumbnail_url ? { url: config.thumbnail_url } : undefined,
                    footer: config.footer ? { text: config.footer } : undefined,
                    fields: config.fields || []
                  }],
                  components: config.components || []
                }}
                botUser={{
                  username: "Seisen Bot",
                  avatar: "https://cdn.discordapp.com/embed/avatars/0.png"
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
