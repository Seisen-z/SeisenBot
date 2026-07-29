"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Copy, Eye, FileJson, Sparkles, UploadIcon, Trash2Icon, PlusIcon } from "lucide-react";
import { DiscordMessagePreview } from "./discord-message";
import { ImageUploader } from "./image-uploader";

export interface EmbedConfig {
  content?: string;
  title?: string;
  description?: string;
  color?: string | number;
  thumbnail_url?: string;
  image_url?: string;
  images?: string[];
  footer?: string;
  buttons?: { label?: string; url?: string }[];
  [key: string]: any;
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

      const imageUrl = em.image?.url ?? em.image_url ?? "";
      onChange("image_url", imageUrl);

      if (Array.isArray(em.images)) {
        onChange("images", em.images);
      }

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
          image: config.image_url ? { url: config.image_url } : null,
          images: Array.isArray(config.images) && config.images.length > 0 ? config.images : undefined,
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
    config.image_url,
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
      {/* Top Navigation Bar with Icons & Pill Container */}
      <div className="flex overflow-hidden rounded-t-2xl border border-white/10 border-b-0 bg-slate-950/80 backdrop-blur-xl p-1.5 gap-1.5">
        <button
          type="button"
          onClick={() => setTab("visual")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer ${
            tab === "visual"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" /> Visual Editor
        </button>
        <button
          type="button"
          onClick={() => setTab("raw")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer ${
            tab === "raw"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <FileJson className="h-3.5 w-3.5" /> Raw JSON
        </button>
        <button
          type="button"
          onClick={() => setTab("preview")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-200 cursor-pointer ${
            tab === "preview"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/20"
              : "text-slate-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Eye className="h-3.5 w-3.5" /> Live Preview
        </button>
      </div>

      <div className="glass-card min-h-[450px] rounded-b-2xl border border-white/10 bg-slate-950/60 p-6 backdrop-blur-xl shadow-2xl">
        {tab === "visual" && (
          <div className="flex flex-col gap-5">
            {children}
            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-300">Message Content / Outside Text</label>
              <Input
                value={config.content || ""}
                onChange={(e) => onChange("content", e.target.value)}
                placeholder="Text printed above the embed... (e.g. role pings or main message text)"
                className="bg-black/50 border-white/10 text-xs text-white"
              />
            </div>

            <div className="pt-4 border-t border-white/10 space-y-5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Embed Card Configuration</h3>
              <div className="flex flex-col gap-5">
                <ImageUploader 
                  onApplyImage={(url) => onChange("image_url", url)}
                  onApplyThumbnail={(url) => onChange("thumbnail_url", url)}
                  onAddMultiImage={(url) => onChange("images", [...(config.images || []), url])}
                />
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Embed Title</label>
                  <Input
                    value={config.title || ""}
                    onChange={(e) => onChange("title", e.target.value)}
                    placeholder="Enter embed title..."
                    className="bg-black/50 border-white/10 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Description</label>
                  <Textarea
                    className="h-40 font-mono text-xs bg-black/50 border-white/10 text-white"
                    value={config.description || ""}
                    onChange={(e) => onChange("description", e.target.value)}
                    placeholder="Enter embed body description (supports markdown, emojis, URLs)..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-300">Embed Color Accent</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          typeof config.color === "string" && config.color.startsWith("#")
                            ? config.color
                            : typeof config.color === "number"
                            ? `#${config.color.toString(16).padStart(6, "0")}`
                            : "#5865F2"
                        }
                        onChange={(e) => onChange("color", e.target.value)}
                        className="h-9 w-10 cursor-pointer rounded-lg border border-white/10 bg-black/40 p-0.5 shrink-0"
                        title="Pick Accent Color"
                      />
                      <Input
                        value={config.color || ""}
                        placeholder="#5865F2 or Decimal"
                        onChange={(e) => onChange("color", e.target.value)}
                        className="bg-black/50 border-white/10 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-300">Thumbnail URL (Top Right Icon)</label>
                    <Input
                      value={config.thumbnail_url || ""}
                      placeholder="https://..."
                      onChange={(e) => onChange("thumbnail_url", e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-300">Image URL (Large Body Banner)</label>
                    <Input
                      value={config.image_url || ""}
                      placeholder="https://..."
                      onChange={(e) => onChange("image_url", e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-slate-300">Footer Text</label>
                    <Input
                      value={config.footer || ""}
                      placeholder="Enter footer text..."
                      onChange={(e) => onChange("footer", e.target.value)}
                      className="bg-black/50 border-white/10 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-slate-300">Gallery Image URLs (Outside Embed Grid)</label>
                  <div className="space-y-2">
                    {(config.images || []).map((url, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <Input 
                          value={url} 
                          placeholder="https://..."
                          onChange={(e) => {
                            const newImages = [...(config.images || [])];
                            newImages[idx] = e.target.value;
                            onChange("images", newImages);
                          }}
                          className="flex-1 bg-black/50 border-white/10 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const newImages = (config.images || []).filter((_, i) => i !== idx);
                            onChange("images", newImages);
                          }}
                          className="h-8 px-2.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs font-semibold"
                        >
                          <Trash2Icon className="h-3.5 w-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onChange("images", [...(config.images || []), ""])}
                      className="w-full justify-center border-dashed border-white/20 text-xs text-slate-300 hover:border-blue-500 hover:text-blue-400 rounded-lg"
                    >
                      <PlusIcon className="h-3.5 w-3.5 mr-1.5" /> Add Gallery Image URL
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {bottomChildren}
          </div>
        )}

        {tab === "raw" && (
          <div className="flex flex-col h-full space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-white text-sm font-bold uppercase tracking-wider">Raw JSON Source Payload</h4>
                <p className="text-xs text-slate-400 mt-0.5">Paste or upload JSON payload exported from Discohook, Sapphire, or Carl-bot. Changes auto-sync instantly.</p>
              </div>

              <div className="shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json,text/plain"
                  className="hidden"
                  onChange={handleTemplateFileUpload}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="border-white/20 text-xs font-semibold text-slate-300 hover:border-blue-500 hover:text-blue-400"
                >
                  <UploadIcon className="h-3.5 w-3.5 mr-1.5" /> Upload JSON
                </Button>
              </div>
            </div>

            {rawError && <p className="text-xs text-rose-400 font-medium">{rawError}</p>}

            <Textarea
              className="min-h-[400px] flex-1 border-white/10 bg-black/60 font-mono text-xs leading-relaxed text-slate-200 focus:border-blue-500"
              value={rawText}
              onChange={(e) => handleRawChange(e.target.value)}
              placeholder="{...}"
              spellCheck={false}
            />
          </div>
        )}

        {tab === "preview" && (
          <div className="min-h-[420px] rounded-2xl border border-white/10 bg-[#313338] p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 border-b border-white/10 pb-3 text-slate-400 text-xs font-semibold">
              <span className="text-slate-500 font-bold text-sm">#</span>
              <span>preview-channel</span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300 ml-auto">LIVE DISCORD SIMULATOR</span>
            </div>
            <div className="w-full max-w-[540px]">
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
                    image: config.image_url ? { url: config.image_url } : undefined,
                    images: Array.isArray(config.images) && config.images.length > 0 ? config.images.map(url => ({ url })) : undefined,
                    footer: config.footer ? { text: config.footer } : undefined,
                    fields: config.fields || []
                  }],
                  components: Array.isArray(config.components) && config.components.length > 0
                    ? config.components
                    : Array.isArray(config.buttons) && config.buttons.length > 0
                    ? [{
                        type: 1,
                        components: config.buttons
                          .filter((b: any) => b?.url)
                          .slice(0, 5)
                          .map((b: any) => ({ type: 2, style: 5, label: b.label || "Button", url: b.url })),
                      }]
                    : []
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
