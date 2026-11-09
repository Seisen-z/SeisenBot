"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import {
  AlignCenterHorizontalIcon,
  AlignCenterVerticalIcon,
  AlignEndHorizontalIcon,
  AlignEndVerticalIcon,
  AlignStartHorizontalIcon,
  AlignStartVerticalIcon,
  BoldIcon,
  BlendIcon,
  ChevronDownIcon,
  CircleIcon,
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  FlipHorizontal2Icon,
  FlipVertical2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  LockIcon,
  MinusIcon,
  MousePointer2Icon,
  PlusIcon,
  Redo2Icon,
  SquareIcon,
  TypeIcon,
  UnlinkIcon,
  Undo2Icon,
  UnlockIcon,
  XIcon,
} from "lucide-react";
import { fetchApi } from "@/lib/api";
import {
  BANNER_FONTS,
  BANNER_FONT_STYLESHEET,
  BANNER_TEMPLATES,
  EFFECT_LABELS,
  HANDLE_VECTORS,
  clamp,
  createBannerLayer,
  createEffect,
  createFill,
  createStroke,
  fontIsSingleStyle,
  layerRadii,
  resizeBox,
  rotationFromPointer,
  snapBox,
  uid,
  withAlpha,
} from "@/lib/banner-designer";
import type {
  BannerDesign,
  BannerEffect,
  BannerEffectType,
  BannerFill,
  BannerHandle,
  BannerLayer,
  BannerLayerType,
  BannerStroke,
} from "@/lib/banner-designer";
import { ImageUploader } from "./image-uploader";

// ------------------------------------------------------------------ rendering (matches modules/banner_render.py)

const PREVIEW_TOKENS: Record<string, string> = {
  "${guildname}": "Seisen Hub",
  "${guildmembercount}": "1482",
  "${membercount}": "1482",
  "${username}": "member",
  "${userglobalnickname}": "member",
  "${usermention}": "@member",
  "${userid}": "0",
};

const previewText = (text: string) =>
  Object.entries(PREVIEW_TOKENS).reduce((output, [token, value]) => output.split(token).join(value), text || "");

// The announcement's own text, which banner text layers can show with ${title}, ${description} and ${footer}
export type BannerTokens = { title?: string; description?: string; footer?: string };
const TokenContext = createContext<BannerTokens>({});

const applyAnnouncementTokens = (text: string, tokens: BannerTokens) =>
  text
    .split("${title}").join(tokens.title ?? "")
    .split("${description}").join(tokens.description ?? "")
    .split("${footer}").join(tokens.footer ?? "");

function useTokenText() {
  const tokens = useContext(TokenContext);
  return (text: string) => previewText(applyAnnouncementTokens(text || "", tokens));
}

function useBannerFonts() {
  useEffect(() => {
    if (document.getElementById("banner-designer-fonts")) return;
    const link = document.createElement("link");
    link.id = "banner-designer-fonts";
    link.rel = "stylesheet";
    link.href = BANNER_FONT_STYLESHEET;
    document.head.appendChild(link);
  }, []);
}

const visibleFills = (layer: BannerLayer) => layer.fills.filter((fill) => fill.visible);
const visibleStrokes = (layer: BannerLayer) => layer.strokes.filter((stroke) => stroke.visible && stroke.width > 0);
const visibleEffects = (layer: BannerLayer, type: BannerEffectType) => layer.effects.filter((effect) => effect.visible && effect.type === type);

// A Roblox game's cover photo / icon, looked up through the dashboard and cached per game
type GameImage = { url: string; name: string };
const gameImageCache = new Map<string, Promise<GameImage | null>>();

function loadGameImage(gameId: string, kind: "cover" | "icon"): Promise<GameImage | null> {
  const key = `${kind}:${gameId}`;
  let pending = gameImageCache.get(key);
  if (!pending) {
    pending = fetch(`/api/roblox/thumbnail?universeId=${gameId}&type=${kind}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => (data?.imageUrl ? { url: String(data.imageUrl), name: String(data.gameName || "") } : null))
      .catch(() => null);
    gameImageCache.set(key, pending);
    pending.then((found) => {
      if (!found) gameImageCache.delete(key); // try again next time
    });
  }
  return pending;
}

// The picture an image fill shows right now: its link, or the looked-up cover / icon of its game
function useFillImage(fill: BannerFill): { url: string; name: string; pending: boolean } {
  const gameId = fill.source !== "url" && /^\d+$/.test(fill.game_id) ? fill.game_id : "";
  const kind = fill.source === "roblox_icon" ? "icon" : "cover";
  const key = `${kind}:${gameId}`;
  const [found, setFound] = useState<(GameImage & { key: string }) | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    loadGameImage(gameId, kind).then((result) => {
      if (!cancelled) setFound(result ? { ...result, key } : { url: "", name: "", key });
    });
    return () => {
      cancelled = true;
    };
  }, [gameId, kind, key]);

  // "/api/bot/assets/..." (an upload) is served by the dashboard itself, so a leading slash counts as a link too
  const link = previewText(fill.url);
  if (fill.source === "url") return { url: link.startsWith("http") || link.startsWith("/") ? link : "", name: "", pending: false };
  if (!gameId) return { url: "", name: "", pending: false };
  const resolved = found && found.key === key ? found : null;
  return { url: resolved?.url ?? "", name: resolved?.name ?? "", pending: resolved === null };
}

function strokeShadow(stroke: BannerStroke): string {
  const color = withAlpha(stroke.color, stroke.opacity);
  if (stroke.position === "outside") return `0 0 0 ${stroke.width}px ${color}`;
  if (stroke.position === "center") return `inset 0 0 0 ${stroke.width / 2}px ${color}, 0 0 0 ${stroke.width / 2}px ${color}`;
  return `inset 0 0 0 ${stroke.width}px ${color}`;
}

function FillView({ fill }: { fill: BannerFill }) {
  const image = useFillImage(fill);
  const style: CSSProperties = { position: "absolute", inset: 0, opacity: fill.opacity / 100 };
  if (fill.type === "image") {
    if (!image.url) {
      if (image.pending) return null;
      return (
        <div
          style={{
            ...style,
            border: "1px dashed rgba(255,255,255,0.35)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.55)",
            fontSize: 12,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {fill.source === "url" || !fill.game_id ? "Add image" : "Game not found"}
        </div>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image.url} alt="" draggable={false} style={{ ...style, width: "100%", height: "100%", objectFit: fill.fit === "stretch" ? "fill" : fill.fit }} />;
  }
  if (fill.type === "gradient") {
    return <div style={{ ...style, background: `linear-gradient(${fill.angle}deg, ${fill.color}, ${fill.color2})` }} />;
  }
  return <div style={{ ...style, background: fill.color }} />;
}

function BannerLayerView({ layer, hideText = false }: { layer: BannerLayer; hideText?: boolean }) {
  const withTokens = useTokenText();
  if (!layer.enabled) return null;

  const [tl, tr, br, bl] = layerRadii(layer);
  const radius = layer.type === "ellipse" ? "50%" : `${tl}px ${tr}px ${br}px ${bl}px`;
  const rotate = layer.rotation ? `rotate(${layer.rotation}deg)` : "";
  const flip = layer.flip_x || layer.flip_y ? `scale(${layer.flip_x ? -1 : 1}, ${layer.flip_y ? -1 : 1})` : "";

  const filters: string[] = [];
  for (const effect of visibleEffects(layer, "layer_blur")) filters.push(`blur(${effect.blur / 2}px)`);
  for (const effect of visibleEffects(layer, "drop_shadow")) {
    filters.push(`drop-shadow(${effect.x}px ${effect.y}px ${effect.blur / 2}px ${withAlpha(effect.color, effect.opacity)})`);
  }
  const backgroundBlur = layer.type !== "text" ? visibleEffects(layer, "background_blur")[0] : undefined;

  const wrapper: CSSProperties = {
    position: "absolute",
    left: layer.x,
    top: layer.y,
    width: layer.width,
    height: layer.height,
    opacity: layer.opacity / 100,
    filter: filters.length ? filters.join(" ") : undefined,
    pointerEvents: "none",
  };
  const inner: CSSProperties = {
    position: "absolute",
    inset: 0,
    transform: rotate || undefined,
    pointerEvents: "auto",
    userSelect: "none",
  };

  let content: ReactNode;
  if (layer.type === "text") {
    const fill = [...visibleFills(layer)].reverse().find((entry) => entry.type !== "image");
    const stroke = visibleStrokes(layer)[0];
    content = (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          overflow: "hidden",
          boxSizing: "border-box",
          transform: flip || undefined,
          justifyContent: layer.text_align === "center" ? "center" : layer.text_align === "right" ? "flex-end" : "flex-start",
          alignItems: layer.text_vertical_align === "middle" ? "center" : layer.text_vertical_align === "bottom" ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            width: "100%",
            textAlign: layer.text_align,
            color: hideText ? "transparent" : fill ? withAlpha(fill.color, fill.opacity) : "transparent",
            fontFamily: `"${layer.font_family}", sans-serif`,
            fontSize: layer.font_size,
            fontWeight: layer.font_weight === "bold" ? 700 : 400,
            fontStyle: layer.font_style,
            lineHeight: layer.line_height / 100,
            letterSpacing: layer.letter_spacing,
            whiteSpace: layer.text_wrap ? "pre-wrap" : "pre",
            overflowWrap: layer.text_wrap ? "anywhere" : "normal",
            WebkitTextStroke: stroke && !hideText ? `${stroke.width * 2}px ${withAlpha(stroke.color, stroke.opacity)}` : undefined,
            paintOrder: "stroke fill",
          }}
        >
          {withTokens(layer.text)}
        </div>
      </div>
    );
  } else {
    const fills = visibleFills(layer);
    const strokes = visibleStrokes(layer);
    const innerShadows = visibleEffects(layer, "inner_shadow");
    content = (
      <div style={{ position: "relative", width: "100%", height: "100%", transform: flip || undefined }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden" }}>
          {fills.map((fill) => (
            <FillView key={fill.id} fill={fill} />
          ))}
          {innerShadows.map((effect) => (
            <div
              key={effect.id}
              style={{ position: "absolute", inset: 0, boxShadow: `inset ${effect.x}px ${effect.y}px ${effect.blur}px ${withAlpha(effect.color, effect.opacity)}` }}
            />
          ))}
        </div>
        {strokes.length > 0 && (
          <div style={{ position: "absolute", inset: 0, borderRadius: radius, pointerEvents: "none", boxShadow: strokes.map(strokeShadow).join(", ") }} />
        )}
      </div>
    );
  }

  return (
    <>
      {backgroundBlur && (
        // Kept outside the filtered wrapper so the blur can see the layers behind it
        <div
          style={{
            position: "absolute",
            left: layer.x,
            top: layer.y,
            width: layer.width,
            height: layer.height,
            borderRadius: radius,
            transform: rotate || undefined,
            backdropFilter: `blur(${backgroundBlur.blur / 2}px)`,
            WebkitBackdropFilter: `blur(${backgroundBlur.blur / 2}px)`,
            pointerEvents: "none",
          }}
        />
      )}
      <div style={wrapper} data-layer-id={layer.id}>
        <div style={inner}>{content}</div>
      </div>
    </>
  );
}

// Non-interactive scaled preview of a design (used as the fallback and on the announcement page)
export function BannerStaticPreview({ design, tokens = {}, className }: { design: BannerDesign; tokens?: BannerTokens; className?: string }) {
  useBannerFonts();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(design.width);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.width;
      if (next && next > 0) setWidth(next);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const scale = Math.max(0.01, width / design.width);
  return (
    <TokenContext.Provider value={tokens}>
      <div ref={frameRef} className={`relative w-full overflow-hidden ${className || ""}`} style={{ height: design.height * scale }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: design.width, height: design.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {design.layers.map((layer) => (
            <BannerLayerView key={layer.id} layer={layer} />
          ))}
        </div>
      </div>
    </TokenContext.Provider>
  );
}

// Asks the bot for the image. outputScale 2 is crisp enough for previews; announcements are posted at up to 4x.
async function renderOnBot(guildId: string, design: BannerDesign, tokens: BannerTokens, outputScale = 2): Promise<string> {
  const result = await fetchApi("/trigger/render_announcement_dynamic_image", undefined, {
    method: "POST",
    body: JSON.stringify({ guild_id: guildId, payload: { dynamic_image: { ...design, output_scale: outputScale, tokens } } }),
  });
  const base64 = String(result?.image_base64 || "").trim();
  if (!base64) throw new Error("The bot returned no image");
  return `data:${result?.mime_type || "image/png"};base64,${base64}`;
}

// The exact image the bot will post, rendered by the bot itself
export function BannerBotPreview({ guildId, design, tokens = {}, className }: { guildId: string; design: BannerDesign; tokens?: BannerTokens; className?: string }) {
  const [src, setSrc] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const signature = JSON.stringify({ design, tokens });

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setFailed(false);
      try {
        const next = await renderOnBot(guildId, design, tokens);
        if (!cancelled) setSrc(next);
      } catch {
        if (!cancelled) {
          setSrc("");
          setFailed(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, signature]);

  return (
    <div className={className}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Bot render" className="h-auto w-full" />
      ) : (
        <BannerStaticPreview design={design} tokens={tokens} />
      )}
      {loading && <p className="mt-2 text-xs text-slate-400">Rendering exact bot preview...</p>}
      {failed && <p className="mt-2 text-xs text-amber-300">Bot preview unavailable. Showing the editor preview.</p>}
    </div>
  );
}

// ------------------------------------------------------------------ Figma-style controls

const PANEL = "#2c2c2c";
const BORDER = "#383838";
const FIELD = "#383838";
const ACCENT = "#0d99ff";

function IconButton({
  title,
  onClick,
  active = false,
  disabled = false,
  children,
  size = 28,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  size?: number;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ width: size, height: size, background: active ? ACCENT : undefined }}
      className={`flex shrink-0 items-center justify-center rounded-md text-[#d9d9d9] transition disabled:cursor-not-allowed disabled:opacity-30 ${active ? "text-white" : "hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

function Section({ title, action, children, noBorder = false }: { title: string; action?: ReactNode; children?: ReactNode; noBorder?: boolean }) {
  return (
    <div className="px-3 py-3" style={{ borderBottom: noBorder ? undefined : `1px solid ${BORDER}` }}>
      <div className="flex h-6 items-center justify-between">
        <p className="text-[11px] font-semibold text-white">{title}</p>
        <div className="flex items-center">{action}</div>
      </div>
      {children && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="text-[11px] text-[#8c8c8c]">{children}</p>;
}

function NumInput({
  prefix,
  value,
  onChange,
  min = -99999,
  max = 99999,
  suffix,
  disabled,
}: {
  prefix?: ReactNode;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? String(Math.round(value * 100) / 100);
  return (
    <label
      className="flex h-7 min-w-0 flex-1 items-center rounded-md border border-transparent px-1.5 text-[11px] text-[#8c8c8c] focus-within:border-[#0d99ff] hover:border-[#4d4d4d]"
      style={{ background: FIELD, opacity: disabled ? 0.4 : 1 }}
    >
      {prefix !== undefined && <span className="mr-1.5 flex w-4 shrink-0 justify-center">{prefix}</span>}
      <input
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent text-[11px] text-white outline-none"
        value={shown}
        inputMode="decimal"
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = parseFloat(event.target.value);
          if (Number.isFinite(parsed)) onChange(clamp(parsed, min, max));
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(event) => {
          if (event.key === "Enter") (event.target as HTMLInputElement).blur();
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            const step = event.shiftKey ? 10 : 1;
            onChange(clamp(value + (event.key === "ArrowUp" ? step : -step), min, max));
            setDraft(null);
          }
        }}
      />
      {suffix && <span className="ml-1 shrink-0">{suffix}</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <input
      className="h-7 w-full min-w-0 rounded-md border border-transparent px-2 text-[11px] text-white outline-none placeholder:text-[#6b6b6b] focus:border-[#0d99ff] hover:border-[#4d4d4d]"
      style={{ background: FIELD }}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      spellCheck={false}
    />
  );
}

function SelectInput({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: ReactNode }) {
  return (
    <select
      className="h-7 w-full min-w-0 rounded-md border border-transparent px-1.5 text-[11px] text-white outline-none focus:border-[#0d99ff] hover:border-[#4d4d4d]"
      style={{ background: FIELD }}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

function ColorInput({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const hex = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <input
        type="color"
        disabled={disabled}
        value={hex}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border border-white/20 bg-transparent p-0"
      />
      <input
        disabled={disabled}
        className="h-7 min-w-0 flex-1 bg-transparent text-[11px] uppercase text-white outline-none"
        value={value.replace("#", "")}
        onChange={(event) => onChange(`#${event.target.value.replace("#", "")}`)}
        spellCheck={false}
      />
    </div>
  );
}

// ------------------------------------------------------------------ the designer

interface BannerDesignerModalProps {
  guildId: string;
  open: boolean;
  onClose: () => void;
  design: BannerDesign | null;
  onChange: (design: BannerDesign) => void;
  // The announcement's own text. Banner text layers show it with ${title}, ${description} and ${footer}.
  tokens?: BannerTokens;
  onTokensChange?: (patch: BannerTokens) => void;
}

export function BannerDesignerModal(props: BannerDesignerModalProps) {
  if (!props.open || !props.design) return null;
  return (
    <TokenContext.Provider value={props.tokens ?? {}}>
      <BannerDesignerInner {...props} design={props.design} />
    </TokenContext.Provider>
  );
}

// Colours already used in the design, for the "On this page" row of the pickers
function collectPalette(design: BannerDesign): string[] {
  const found: string[] = [];
  const add = (color: string) => {
    const hex = normalizeHex(color);
    if (hex && !found.includes(hex)) found.push(hex);
  };
  for (const layer of design.layers) {
    for (const fill of layer.fills) {
      if (fill.type === "solid") add(fill.color);
      if (fill.type === "gradient") {
        add(fill.color);
        add(fill.color2);
      }
    }
    for (const stroke of layer.strokes) add(stroke.color);
  }
  return found.slice(0, 16);
}

type Tool = "move" | "rectangle" | "ellipse" | "text" | "image";
type Align = "left" | "center" | "right" | "top" | "middle" | "bottom";

const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2];

function BannerDesignerInner({ guildId, onClose, design, onChange, tokens = {}, onTokensChange }: Omit<BannerDesignerModalProps, "open" | "design"> & { design: BannerDesign }) {
  useBannerFonts();
  const palette = collectPalette(design);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("move");
  const [zoom, setZoom] = useState<number | null>(null);
  const [zoomMenu, setZoomMenu] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [drawBox, setDrawBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState({ width: 800, height: 600 });
  const [lockRatio, setLockRatio] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [imagePicker, setImagePicker] = useState<{ layerId: string; fillId: string } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [exporting, setExporting] = useState("");
  const [, setHistoryTick] = useState(0);

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const designRef = useRef(design);
  const selectedRef = useRef(selectedIds);
  const toolRef = useRef(tool);
  const scaleRef = useRef(1);
  const pastRef = useRef<BannerDesign[]>([]);
  const futureRef = useRef<BannerDesign[]>([]);
  const lastEditRef = useRef({ key: "", at: 0 });
  designRef.current = design;
  selectedRef.current = selectedIds;
  toolRef.current = tool;

  // Measure the area available for the canvas
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setViewport({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitScale = clamp(Math.min((viewport.width - 120) / design.width, (viewport.height - 160) / design.height), 0.1, 2);
  const scale = zoom ?? fitScale;
  scaleRef.current = scale;

  const selectedLayers = design.layers.filter((layer) => selectedIds.includes(layer.id));
  const primary = selectedLayers.length === 1 ? selectedLayers[0] : null;

  // ---------------------------------------------------------------- history

  const pushHistory = useCallback((key?: string) => {
    const now = Date.now();
    if (key && lastEditRef.current.key === key && now - lastEditRef.current.at < 900) {
      lastEditRef.current.at = now;
      return;
    }
    lastEditRef.current = { key: key || "", at: now };
    pastRef.current.push(designRef.current);
    if (pastRef.current.length > 100) pastRef.current.shift();
    futureRef.current = [];
    setHistoryTick((tick) => tick + 1);
  }, []);

  const undo = useCallback(() => {
    const previous = pastRef.current.pop();
    if (!previous) return;
    futureRef.current.push(designRef.current);
    lastEditRef.current = { key: "", at: 0 };
    onChange(previous);
    setSelectedIds((ids) => ids.filter((id) => previous.layers.some((layer) => layer.id === id)));
    setHistoryTick((tick) => tick + 1);
  }, [onChange]);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(designRef.current);
    lastEditRef.current = { key: "", at: 0 };
    onChange(next);
    setHistoryTick((tick) => tick + 1);
  }, [onChange]);

  const commit = useCallback(
    (next: BannerDesign, key?: string) => {
      pushHistory(key);
      onChange(next);
    },
    [onChange, pushHistory],
  );

  const patchLayer = useCallback(
    (id: string, patch: Partial<BannerLayer>, key?: string) => {
      commit({ ...designRef.current, layers: designRef.current.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) }, key ? `${id}:${key}` : undefined);
    },
    [commit],
  );

  // ---------------------------------------------------------------- layer actions

  const addLayerAt = (type: BannerLayerType, box: { x: number; y: number; width: number; height: number }, overrides: Partial<BannerLayer> = {}) => {
    const layer = createBannerLayer(type, { ...box, ...overrides });
    commit({ ...designRef.current, layers: [...designRef.current.layers, layer] });
    setSelectedIds([layer.id]);
    return layer;
  };

  const duplicateSelected = useCallback(() => {
    const current = designRef.current;
    const ids = selectedRef.current;
    if (!ids.length) return;
    const copies: BannerLayer[] = [];
    const layers: BannerLayer[] = [];
    for (const layer of current.layers) {
      layers.push(layer);
      if (ids.includes(layer.id)) {
        const copy: BannerLayer = {
          ...JSON.parse(JSON.stringify(layer)),
          id: uid("layer"),
          name: `${layer.name} copy`,
          x: layer.x + 16,
          y: layer.y + 16,
          locked: false,
        };
        copy.fills = copy.fills.map((fill) => ({ ...fill, id: uid("fill") }));
        copy.strokes = copy.strokes.map((stroke) => ({ ...stroke, id: uid("stroke") }));
        copy.effects = copy.effects.map((effect) => ({ ...effect, id: uid("effect") }));
        copies.push(copy);
        layers.push(copy);
      }
    }
    commit({ ...current, layers });
    setSelectedIds(copies.map((copy) => copy.id));
  }, [commit]);

  const deleteSelected = useCallback(() => {
    const current = designRef.current;
    const ids = selectedRef.current;
    if (!ids.length) return;
    commit({ ...current, layers: current.layers.filter((layer) => !ids.includes(layer.id)) });
    setSelectedIds([]);
  }, [commit]);

  const reorderLayer = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const layers = designRef.current.layers.filter((layer) => layer.id !== draggedId);
    const dragged = designRef.current.layers.find((layer) => layer.id === draggedId);
    const targetIndex = layers.findIndex((layer) => layer.id === targetId);
    if (!dragged || targetIndex < 0) return;
    layers.splice(targetIndex + 1, 0, dragged); // dropped on a row = placed just above it (towards the front)
    commit({ ...designRef.current, layers });
  };

  const alignSelected = (axis: Align) => {
    if (!selectedLayers.length) return;
    const bounds =
      selectedLayers.length === 1
        ? { x: 0, y: 0, width: design.width, height: design.height }
        : (() => {
            const left = Math.min(...selectedLayers.map((layer) => layer.x));
            const top = Math.min(...selectedLayers.map((layer) => layer.y));
            const right = Math.max(...selectedLayers.map((layer) => layer.x + layer.width));
            const bottom = Math.max(...selectedLayers.map((layer) => layer.y + layer.height));
            return { x: left, y: top, width: right - left, height: bottom - top };
          })();
    const next = design.layers.map((layer) => {
      if (!selectedIds.includes(layer.id)) return layer;
      if (axis === "left") return { ...layer, x: bounds.x };
      if (axis === "center") return { ...layer, x: Math.round(bounds.x + (bounds.width - layer.width) / 2) };
      if (axis === "right") return { ...layer, x: bounds.x + bounds.width - layer.width };
      if (axis === "top") return { ...layer, y: bounds.y };
      if (axis === "middle") return { ...layer, y: Math.round(bounds.y + (bounds.height - layer.height) / 2) };
      return { ...layer, y: bounds.y + bounds.height - layer.height };
    });
    commit({ ...design, layers: next });
  };

  const exportPng = async (outputScale: number) => {
    setExporting("Exporting...");
    try {
      const url = await renderOnBot(guildId, design, tokens, outputScale);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${design.name || "banner"}${outputScale > 1 ? `@${outputScale}x` : ""}.png`;
      link.click();
      setExporting("");
    } catch {
      setExporting("Export failed: the bot is unreachable.");
    }
  };

  // ---------------------------------------------------------------- keyboard

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      const meta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      } else if (meta && key === "y") {
        event.preventDefault();
        redo();
      } else if (meta && key === "d") {
        event.preventDefault();
        duplicateSelected();
      } else if (!meta && key === "v") setTool("move");
      else if (!meta && key === "r") setTool("rectangle");
      else if (!meta && key === "o") setTool("ellipse");
      else if (!meta && key === "t") setTool("text");
      else if (!meta && key === "i") setTool("image");
      else if (key === "delete" || key === "backspace") {
        event.preventDefault();
        deleteSelected();
      } else if (key === "escape") {
        setTool("move");
        setSelectedIds([]);
      } else if (key.startsWith("arrow")) {
        const ids = selectedRef.current;
        if (!ids.length) return;
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        pushHistory("nudge");
        const current = designRef.current;
        onChange({ ...current, layers: current.layers.map((layer) => (ids.includes(layer.id) && !layer.locked ? { ...layer, x: layer.x + dx, y: layer.y + dy } : layer)) });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, duplicateSelected, deleteSelected, pushHistory, onChange]);

  // ---------------------------------------------------------------- pointer gestures

  const trackPointer = (onMove: (event: PointerEvent) => void, onEnd?: () => void) => {
    const handleUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", handleUp);
      onEnd?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", handleUp);
  };

  const designPoint = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    return { x: rect ? (clientX - rect.left) / scaleRef.current : 0, y: rect ? (clientY - rect.top) / scaleRef.current : 0 };
  };

  const startDraw = (event: ReactPointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const drawTool = toolRef.current;
    const start = designPoint(event.clientX, event.clientY);
    let box = { x: start.x, y: start.y, width: 0, height: 0 };
    trackPointer(
      (move) => {
        const point = designPoint(move.clientX, move.clientY);
        box = { x: Math.min(start.x, point.x), y: Math.min(start.y, point.y), width: Math.abs(point.x - start.x), height: Math.abs(point.y - start.y) };
        setDrawBox(box);
      },
      () => {
        setDrawBox(null);
        const dragged = box.width >= 4 && box.height >= 4;
        const fallback = drawTool === "text" ? { width: 200, height: 40 } : { width: 120, height: 120 };
        const final = dragged
          ? { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height) }
          : { x: Math.round(start.x), y: Math.round(start.y), width: fallback.width, height: fallback.height };
        if (drawTool === "text") {
          const layer = addLayerAt("text", final, { text: "Text", font_size: clamp(Math.round(final.height * 0.6), 10, 120) });
          setEditingId(layer.id);
        } else if (drawTool === "image") {
          const fill = createFill("image", { url: "" });
          const layer = addLayerAt("rectangle", final, { name: "Image", fills: [fill] });
          setImagePicker({ layerId: layer.id, fillId: fill.id });
        } else {
          addLayerAt(drawTool === "ellipse" ? "ellipse" : "rectangle", final);
        }
        setTool("move");
      },
    );
  };

  const startMove = (event: ReactPointerEvent, layer: BannerLayer) => {
    if (toolRef.current !== "move") return; // a drawing tool is active: let the stage start the drawing
    event.stopPropagation();
    if (event.shiftKey) {
      setSelectedIds((ids) => (ids.includes(layer.id) ? ids.filter((id) => id !== layer.id) : [...ids, layer.id]));
      return;
    }
    const ids = selectedRef.current.includes(layer.id) ? selectedRef.current : [layer.id];
    setSelectedIds(ids);
    if (layer.locked) return;

    const startDesign = designRef.current;
    const movable = startDesign.layers.filter((entry) => ids.includes(entry.id) && !entry.locked);
    if (!movable.length) return;
    const startLeft = Math.min(...movable.map((entry) => entry.x));
    const startTop = Math.min(...movable.map((entry) => entry.y));
    const startRight = Math.max(...movable.map((entry) => entry.x + entry.width));
    const startBottom = Math.max(...movable.map((entry) => entry.y + entry.height));
    const others = startDesign.layers.filter((entry) => !ids.includes(entry.id) && entry.enabled);
    const originX = event.clientX;
    const originY = event.clientY;
    let moved = false;

    trackPointer(
      (move) => {
        if (!moved && Math.hypot(move.clientX - originX, move.clientY - originY) < 3) return;
        if (!moved) {
          moved = true;
          pushHistory();
        }
        let dx = (move.clientX - originX) / scaleRef.current;
        let dy = (move.clientY - originY) / scaleRef.current;
        if (!move.altKey) {
          const snap = snapBox(
            { x: startLeft + dx, y: startTop + dy, width: startRight - startLeft, height: startBottom - startTop },
            others,
            startDesign.width,
            startDesign.height,
            6 / scaleRef.current,
          );
          dx += snap.dx;
          dy += snap.dy;
          setGuides({ x: snap.guideX, y: snap.guideY });
        } else {
          setGuides({ x: null, y: null });
        }
        onChange({
          ...startDesign,
          layers: startDesign.layers.map((entry) => (movable.some((item) => item.id === entry.id) ? { ...entry, x: Math.round(entry.x + dx), y: Math.round(entry.y + dy) } : entry)),
        });
      },
      () => setGuides({ x: null, y: null }),
    );
  };

  const startResize = (event: ReactPointerEvent, layer: BannerLayer, handle: BannerHandle) => {
    event.stopPropagation();
    event.preventDefault();
    const startDesign = designRef.current;
    const originX = event.clientX;
    const originY = event.clientY;
    let started = false;
    trackPointer((move) => {
      if (!started) {
        started = true;
        pushHistory();
      }
      const box = resizeBox(
        { x: layer.x, y: layer.y, width: layer.width, height: layer.height, rotation: layer.rotation },
        handle,
        (move.clientX - originX) / scaleRef.current,
        (move.clientY - originY) / scaleRef.current,
        move.shiftKey || lockRatio,
      );
      onChange({ ...startDesign, layers: startDesign.layers.map((entry) => (entry.id === layer.id ? { ...entry, ...box } : entry)) });
    });
  };

  const startRotate = (event: ReactPointerEvent, layer: BannerLayer) => {
    event.stopPropagation();
    event.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const startDesign = designRef.current;
    const rect = stage.getBoundingClientRect();
    const centerX = rect.left + (layer.x + layer.width / 2) * scaleRef.current;
    const centerY = rect.top + (layer.y + layer.height / 2) * scaleRef.current;
    let started = false;
    trackPointer((move) => {
      if (!started) {
        started = true;
        pushHistory();
      }
      const rotation = rotationFromPointer(centerX, centerY, move.clientX, move.clientY, move.shiftKey);
      onChange({ ...startDesign, layers: startDesign.layers.map((entry) => (entry.id === layer.id ? { ...entry, rotation } : entry)) });
    });
  };

  const applyTemplate = (id: string) => {
    const template = BANNER_TEMPLATES.find((entry) => entry.id === id);
    if (!template) return;
    if (!window.confirm("Replace the current design with this template?")) return;
    commit(template.create());
    setSelectedIds([]);
  };

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;
  const topImageFill = primary ? [...primary.fills].reverse().find((fill) => fill.type === "image" && fill.visible) : undefined;
  const editingLayer = editingId ? design.layers.find((layer) => layer.id === editingId && layer.type === "text") : undefined;

  const handleSpots: Record<BannerHandle, CSSProperties> = {
    nw: { left: -4, top: -4, cursor: "nwse-resize" },
    n: { left: "calc(50% - 4px)", top: -4, cursor: "ns-resize" },
    ne: { right: -4, top: -4, cursor: "nesw-resize" },
    e: { right: -4, top: "calc(50% - 4px)", cursor: "ew-resize" },
    se: { right: -4, bottom: -4, cursor: "nwse-resize" },
    s: { left: "calc(50% - 4px)", bottom: -4, cursor: "ns-resize" },
    sw: { left: -4, bottom: -4, cursor: "nesw-resize" },
    w: { left: -4, top: "calc(50% - 4px)", cursor: "ew-resize" },
  };

  const checker = "repeating-conic-gradient(#232323 0% 25%, #1e1e1e 0% 50%) 50% / 16px 16px";

  return (
    <div className="fixed inset-0 z-50 flex bg-[#1e1e1e] text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ---------------------------------------------------------- left: file + layers */}
      <div className="flex w-60 shrink-0 flex-col" style={{ background: PANEL, borderRight: `1px solid ${BORDER}` }}>
        <div className="px-3 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center gap-1">
            <IconButton title="Close the designer" onClick={onClose}><XIcon className="h-4 w-4" /></IconButton>
            <div className="min-w-0 flex-1">
              <input
                className="w-full bg-transparent text-xs font-semibold text-white outline-none"
                value={design.name}
                onChange={(event) => commit({ ...design, name: event.target.value }, "canvas-name")}
              />
              <p className="text-[10px] text-[#8c8c8c]">Banner designer · Drafts</p>
            </div>
            <IconButton title="Undo (Ctrl+Z)" onClick={undo} disabled={!canUndo}><Undo2Icon className="h-4 w-4" /></IconButton>
            <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={!canRedo}><Redo2Icon className="h-4 w-4" /></IconButton>
          </div>
        </div>

        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <p className="text-[11px] font-semibold text-white">Layers</p>
          <p className="text-[10px] text-[#6b6b6b]">{design.layers.length}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
          {[...design.layers].reverse().map((layer) => {
            const selected = selectedIds.includes(layer.id);
            return (
              <div
                key={layer.id}
                draggable
                onDragStart={() => setDragId(layer.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (dragId) reorderLayer(dragId, layer.id);
                  setDragId(null);
                }}
                onClick={(event) => setSelectedIds((ids) => (event.shiftKey ? (ids.includes(layer.id) ? ids.filter((id) => id !== layer.id) : [...ids, layer.id]) : [layer.id]))}
                className="group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2"
                style={{ background: selected ? "rgba(13,153,255,0.28)" : undefined, opacity: dragId === layer.id ? 0.4 : 1 }}
              >
                <span className="text-[#b3b3b3]">
                  {layer.type === "text" ? <TypeIcon className="h-3.5 w-3.5" /> : layer.type === "ellipse" ? <CircleIcon className="h-3.5 w-3.5" /> : layer.fills.some((fill) => fill.type === "image") ? <ImageIcon className="h-3.5 w-3.5" /> : <SquareIcon className="h-3.5 w-3.5" />}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[11px] ${layer.enabled ? "text-white" : "text-[#6b6b6b]"}`}>{layer.name}</span>
                <button type="button" title={layer.locked ? "Unlock" : "Lock"} onClick={(event) => { event.stopPropagation(); patchLayer(layer.id, { locked: !layer.locked }); }} className={`${layer.locked ? "" : "opacity-0 group-hover:opacity-100"} text-[#b3b3b3] hover:text-white`}>
                  {layer.locked ? <LockIcon className="h-3.5 w-3.5" /> : <UnlockIcon className="h-3.5 w-3.5" />}
                </button>
                <button type="button" title={layer.enabled ? "Hide" : "Show"} onClick={(event) => { event.stopPropagation(); patchLayer(layer.id, { enabled: !layer.enabled }); }} className={`${layer.enabled ? "opacity-0 group-hover:opacity-100" : ""} text-[#b3b3b3] hover:text-white`}>
                  {layer.enabled ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}
                </button>
              </div>
            );
          })}
          {design.layers.length === 0 && <p className="px-2 py-4 text-[11px] text-[#6b6b6b]">Empty. Pick a tool at the bottom and draw on the canvas.</p>}
        </div>
        <p className="px-3 py-2 text-[10px] leading-relaxed text-[#6b6b6b]" style={{ borderTop: `1px solid ${BORDER}` }}>
          V move · R rectangle · O ellipse · T text · I image · Shift = keep ratio / snap angle / multi-select · Alt = no snap · Arrows nudge · Ctrl+D duplicate · Drag layers to reorder
        </p>
      </div>

      {/* ---------------------------------------------------------- canvas */}
      <div className="relative min-w-0 flex-1">
        <div
          ref={viewportRef}
          className="absolute inset-0 overflow-auto"
          style={{ background: checker }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget && toolRef.current === "move") setSelectedIds([]);
          }}
        >
          {previewMode ? (
            <div className="flex min-h-full items-center justify-center p-10">
              <div style={{ width: design.width * scale }}>
                <BannerBotPreview guildId={guildId} design={design} tokens={tokens} />
              </div>
            </div>
          ) : (
            <div
              className="flex min-h-full min-w-full items-center justify-center p-16 pb-28"
              style={{ cursor: tool === "move" ? "default" : "crosshair" }}
              onPointerDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (toolRef.current === "move") setSelectedIds([]);
              }}
            >
              <div ref={stageRef} className="relative shrink-0" style={{ width: design.width * scale, height: design.height * scale, boxShadow: "0 0 0 1px rgba(255,255,255,0.14)" }}>
                <div
                  className="absolute left-0 top-0 overflow-hidden"
                  style={{ width: design.width, height: design.height, transform: `scale(${scale})`, transformOrigin: "top left" }}
                  onPointerDown={(event) => {
                    if (toolRef.current !== "move") startDraw(event);
                    else if (event.target === event.currentTarget) setSelectedIds([]);
                  }}
                >
                  {design.layers.map((layer) => (
                    <div
                      key={layer.id}
                      onPointerDown={(event) => startMove(event, layer)}
                      onDoubleClick={() => {
                        if (layer.type === "text" && !layer.locked) setEditingId(layer.id);
                      }}
                    >
                      <BannerLayerView layer={layer} hideText={editingId === layer.id} />
                    </div>
                  ))}

                  {editingLayer && (
                    <textarea
                      autoFocus
                      value={editingLayer.text}
                      onChange={(event) => patchLayer(editingLayer.id, { text: event.target.value }, "text")}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setEditingId(null);
                        event.stopPropagation();
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      style={{
                        position: "absolute",
                        left: editingLayer.x,
                        top: editingLayer.y,
                        width: editingLayer.width,
                        height: editingLayer.height,
                        transform: editingLayer.rotation ? `rotate(${editingLayer.rotation}deg)` : undefined,
                        background: "rgba(13,153,255,0.08)",
                        outline: "none",
                        border: "none",
                        resize: "none",
                        padding: 0,
                        margin: 0,
                        overflow: "hidden",
                        textAlign: editingLayer.text_align,
                        color: (visibleFills(editingLayer).find((fill) => fill.type !== "image")?.color) || "#000",
                        fontFamily: `"${editingLayer.font_family}", sans-serif`,
                        fontSize: editingLayer.font_size,
                        fontWeight: editingLayer.font_weight === "bold" ? 700 : 400,
                        fontStyle: editingLayer.font_style,
                        lineHeight: editingLayer.line_height / 100,
                        letterSpacing: editingLayer.letter_spacing,
                        whiteSpace: editingLayer.text_wrap ? "pre-wrap" : "pre",
                      }}
                    />
                  )}

                  {drawBox && (
                    <div style={{ position: "absolute", left: drawBox.x, top: drawBox.y, width: drawBox.width, height: drawBox.height, border: `${1 / scale}px solid ${ACCENT}`, background: "rgba(13,153,255,0.1)", pointerEvents: "none" }} />
                  )}
                </div>

                {/* Selection + handles (screen-sized, not scaled) */}
                {selectedLayers.map((layer) => {
                  if (!layer.enabled) return null;
                  const isPrimary = primary?.id === layer.id && !layer.locked && editingId !== layer.id;
                  return (
                    <div
                      key={`sel-${layer.id}`}
                      className="pointer-events-none absolute"
                      style={{
                        left: layer.x * scale,
                        top: layer.y * scale,
                        width: layer.width * scale,
                        height: layer.height * scale,
                        transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
                        outline: `1.5px solid ${ACCENT}`,
                      }}
                    >
                      {isPrimary &&
                        (Object.keys(HANDLE_VECTORS) as BannerHandle[]).map((handle) => (
                          <div
                            key={handle}
                            onPointerDown={(event) => startResize(event, layer, handle)}
                            className="pointer-events-auto absolute h-2 w-2 bg-white"
                            style={{ ...handleSpots[handle], border: `1px solid ${ACCENT}` }}
                          />
                        ))}
                      {isPrimary && (
                        <>
                          <div className="absolute left-1/2 -top-5 h-5 w-px" style={{ background: ACCENT }} />
                          <div
                            onPointerDown={(event) => startRotate(event, layer)}
                            title="Rotate"
                            className="pointer-events-auto absolute -top-7 h-3 w-3 -translate-x-1/2 cursor-grab rounded-full bg-white"
                            style={{ left: "50%", border: `1px solid ${ACCENT}` }}
                          />
                        </>
                      )}
                      {isPrimary && (
                        <div className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] text-white" style={{ background: ACCENT }}>
                          {Math.round(layer.width)} × {Math.round(layer.height)}
                        </div>
                      )}
                    </div>
                  );
                })}

                {guides.x !== null && <div className="pointer-events-none absolute top-0 h-full w-px bg-[#ff3366]" style={{ left: guides.x * scale }} />}
                {guides.y !== null && <div className="pointer-events-none absolute left-0 h-px w-full bg-[#ff3366]" style={{ top: guides.y * scale }} />}
              </div>
            </div>
          )}
        </div>

        {/* contextual bar for image layers */}
        {primary && topImageFill && !previewMode && (
          <div className="absolute bottom-[76px] left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl px-2 py-1.5 shadow-xl" style={{ background: "#1e1e1e", border: `1px solid ${BORDER}` }}>
            {(["cover", "contain", "stretch"] as const).map((fit) => (
              <button
                key={fit}
                type="button"
                onClick={() => patchLayer(primary.id, { fills: primary.fills.map((fill) => (fill.id === topImageFill.id ? { ...fill, fit } : fill)) })}
                className="rounded-md px-2.5 py-1 text-[11px] text-white"
                style={{ background: topImageFill.fit === fit ? ACCENT : "transparent" }}
              >
                {fit === "cover" ? "Fill" : fit === "contain" ? "Fit" : "Stretch"}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            <button type="button" onClick={() => setImagePicker({ layerId: primary.id, fillId: topImageFill.id })} className="rounded-md px-2.5 py-1 text-[11px] text-white hover:bg-white/10">
              Replace image
            </button>
          </div>
        )}

        {/* bottom tool bar */}
        <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl px-2 py-1.5 shadow-xl" style={{ background: "#1e1e1e", border: `1px solid ${BORDER}` }}>
          <IconButton title="Move (V)" active={tool === "move"} onClick={() => setTool("move")} size={34}><MousePointer2Icon className="h-4 w-4" /></IconButton>
          <IconButton title="Rectangle (R)" active={tool === "rectangle"} onClick={() => setTool("rectangle")} size={34}><SquareIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Ellipse (O)" active={tool === "ellipse"} onClick={() => setTool("ellipse")} size={34}><CircleIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Text (T)" active={tool === "text"} onClick={() => setTool("text")} size={34}><TypeIcon className="h-4 w-4" /></IconButton>
          <IconButton title="Image (I)" active={tool === "image"} onClick={() => setTool("image")} size={34}><ImageIcon className="h-4 w-4" /></IconButton>
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button
            type="button"
            title="See exactly what the bot will post"
            onClick={() => setPreviewMode((value) => !value)}
            className="h-[34px] rounded-md px-3 text-[11px] font-semibold text-white"
            style={{ background: previewMode ? ACCENT : "transparent" }}
          >
            Bot preview
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------- right: Design panel */}
      <div className="flex w-[264px] shrink-0 flex-col" style={{ background: PANEL, borderLeft: `1px solid ${BORDER}` }}>
        <div className="flex h-11 shrink-0 items-center justify-between px-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
          <span className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.1)" }}>Design</span>
          <div className="relative flex items-center gap-2">
            <button type="button" onClick={() => setZoomMenu((open) => !open)} className="flex items-center gap-0.5 text-[11px] text-white hover:text-[#b3b3b3]">
              {Math.round(scale * 100)}% <ChevronDownIcon className="h-3 w-3" />
            </button>
            {zoomMenu && (
              <div className="absolute right-0 top-7 z-10 w-36 rounded-lg py-1 shadow-xl" style={{ background: "#1e1e1e", border: `1px solid ${BORDER}` }}>
                {ZOOM_PRESETS.map((preset) => (
                  <button key={preset} type="button" onClick={() => { setZoom(preset); setZoomMenu(false); }} className="block w-full px-3 py-1.5 text-left text-[11px] text-white hover:bg-white/10">
                    {Math.round(preset * 100)}%
                  </button>
                ))}
                <button type="button" onClick={() => { setZoom(null); setZoomMenu(false); }} className="block w-full px-3 py-1.5 text-left text-[11px] text-white hover:bg-white/10">Zoom to fit</button>
              </div>
            )}
            <button type="button" onClick={onClose} className="rounded-md px-3 py-1 text-[11px] font-semibold text-white" style={{ background: ACCENT }}>Done</button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {selectedLayers.length === 0 && (
            <>
              <Section title="Frame">
                <TextInput value={design.name} onChange={(value) => commit({ ...design, name: value }, "canvas-name")} />
                <Label>Dimensions</Label>
                <div className="flex gap-2">
                  <NumInput prefix="W" value={design.width} min={128} max={4000} onChange={(value) => commit({ ...design, width: value }, "canvas-w")} />
                  <NumInput prefix="H" value={design.height} min={128} max={4000} onChange={(value) => commit({ ...design, height: value }, "canvas-h")} />
                </div>
                <p className="text-[10px] leading-relaxed text-[#6b6b6b]">The image is transparent outside your shapes. Add a rectangle for a background.</p>
              </Section>
              {onTokensChange && (
                <Section title="Announcement text">
                  <p className="text-[10px] leading-relaxed text-[#6b6b6b]">
                    The same text as the announcement. Text layers show it when they contain {"${title}"}, {"${description}"} or {"${footer}"}. Change it here or in the announcement.
                  </p>
                  <Label>Title</Label>
                  <TextInput value={tokens.title ?? ""} onChange={(value) => onTokensChange({ title: value })} />
                  <Label>Description</Label>
                  <textarea
                    rows={6}
                    value={tokens.description ?? ""}
                    onChange={(event) => onTokensChange({ description: event.target.value })}
                    className="w-full resize-y rounded-md border border-transparent p-2 text-[11px] text-white outline-none focus:border-[#0d99ff]"
                    style={{ background: FIELD }}
                  />
                  <Label>Footer</Label>
                  <TextInput value={tokens.footer ?? ""} onChange={(value) => onTokensChange({ footer: value })} />
                </Section>
              )}
              <Section title="Template">
                <SelectInput value="" onChange={(value) => value && applyTemplate(value)}>
                  <option value="">Replace with a template...</option>
                  {BANNER_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>{template.label}</option>
                  ))}
                </SelectInput>
              </Section>
            </>
          )}

          {selectedLayers.length > 1 && (
            <Section title={`${selectedLayers.length} layers selected`}>
              <AlignRow onAlign={alignSelected} />
              <div className="flex gap-2">
                <button type="button" onClick={duplicateSelected} className="flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11px] text-white" style={{ background: FIELD }}><CopyIcon className="h-3.5 w-3.5" />Duplicate</button>
                <button type="button" onClick={deleteSelected} className="h-7 flex-1 rounded-md text-[11px] text-[#ff7a7a]" style={{ background: FIELD }}>Delete</button>
              </div>
            </Section>
          )}

          {primary && (
            <LayerProperties
              layer={primary}
              palette={palette}
              lockRatio={lockRatio}
              setLockRatio={setLockRatio}
              patch={(patch, key) => patchLayer(primary.id, patch, key)}
              onAlign={alignSelected}
              onDuplicate={duplicateSelected}
              onDelete={deleteSelected}
              onPickImage={(fillId) => setImagePicker({ layerId: primary.id, fillId })}
            />
          )}

          <ExportSection onExport={exportPng} status={exporting} name={design.name} guildId={guildId} design={design} tokens={tokens} />
        </div>
      </div>

      {imagePicker && (
        <ImagePickerModal
          onClose={() => setImagePicker(null)}
          onPick={(url) => {
            const layer = designRef.current.layers.find((entry) => entry.id === imagePicker.layerId);
            if (layer) {
              patchLayer(layer.id, { fills: layer.fills.map((fill) => (fill.id === imagePicker.fillId ? { ...fill, url, source: "url" } : fill)) });
            }
            setImagePicker(null);
          }}
        />
      )}
    </div>
  );
}

function ImagePickerModal({ onClose, onPick }: { onClose: () => void; onPick: (url: string) => void }) {
  const [url, setUrl] = useState("");
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-xl p-4 shadow-2xl" style={{ background: PANEL, border: `1px solid ${BORDER}` }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-white">Choose an image</p>
          <IconButton title="Close" onClick={onClose}><XIcon className="h-4 w-4" /></IconButton>
        </div>
        <Label>Paste an image link</Label>
        <div className="mt-1 flex gap-2">
          <TextInput value={url} onChange={setUrl} placeholder="https://..." />
          <button type="button" disabled={!url.trim()} onClick={() => onPick(url.trim())} className="h-7 shrink-0 rounded-md px-3 text-[11px] font-semibold text-white disabled:opacity-40" style={{ background: ACCENT }}>Use</button>
        </div>
        <p className="mb-1 mt-4 text-[11px] text-[#8c8c8c]">Or pick one you uploaded</p>
        <div className="max-h-72 overflow-y-auto rounded-lg bg-black/20 p-2">
          <ImageUploader onApplyImage={onPick} />
        </div>
      </div>
    </div>
  );
}

function AlignRow({ onAlign }: { onAlign: (axis: Align) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex gap-0.5">
        <IconButton title="Align left" onClick={() => onAlign("left")}><AlignStartVerticalIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Align horizontal centers" onClick={() => onAlign("center")}><AlignCenterVerticalIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Align right" onClick={() => onAlign("right")}><AlignEndVerticalIcon className="h-4 w-4" /></IconButton>
      </div>
      <div className="flex gap-0.5">
        <IconButton title="Align top" onClick={() => onAlign("top")}><AlignStartHorizontalIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Align vertical centers" onClick={() => onAlign("middle")}><AlignCenterHorizontalIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Align bottom" onClick={() => onAlign("bottom")}><AlignEndHorizontalIcon className="h-4 w-4" /></IconButton>
      </div>
    </div>
  );
}

function ExportSection({
  onExport,
  status,
  name,
  guildId,
  design,
  tokens,
}: {
  onExport: (scale: number) => void;
  status: string;
  name: string;
  guildId: string;
  design: BannerDesign;
  tokens: BannerTokens;
}) {
  const [rows, setRows] = useState<number[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  return (
    <Section
      title="Export"
      noBorder
      action={<IconButton title="Add export setting" onClick={() => setRows((current) => [...current, 2])}><PlusIcon className="h-4 w-4" /></IconButton>}
    >
      {rows.map((scaleValue, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <SelectInput value={String(scaleValue)} onChange={(value) => setRows((current) => current.map((entry, i) => (i === index ? Number(value) : entry)))}>
            {[1, 2, 3, 4].map((option) => (
              <option key={option} value={option}>{option}x</option>
            ))}
          </SelectInput>
          <SelectInput value="png" onChange={() => undefined}>
            <option value="png">PNG</option>
          </SelectInput>
          <IconButton title="Remove" onClick={() => setRows((current) => current.filter((_, i) => i !== index))}><MinusIcon className="h-4 w-4" /></IconButton>
        </div>
      ))}
      {rows.length > 0 && (
        <button type="button" onClick={() => rows.forEach((value) => onExport(value))} className="h-8 w-full rounded-md text-[11px] font-semibold text-white" style={{ background: FIELD }}>
          Export {name || "banner"}
        </button>
      )}
      {rows.length === 0 && <p className="text-[10px] text-[#6b6b6b]">Press + to download this banner as a PNG.</p>}
      {status && <p className="text-[10px] text-[#8c8c8c]">{status}</p>}
      <button type="button" onClick={() => setShowPreview((value) => !value)} className="flex items-center gap-1.5 text-[11px] text-[#b3b3b3] hover:text-white">
        <span className="inline-block w-3">{showPreview ? "▾" : "▸"}</span> Preview
      </button>
      {showPreview && <BannerBotPreview guildId={guildId} design={design} tokens={tokens} />}
    </Section>
  );
}

// ------------------------------------------------------------------ properties for one layer

function LayerProperties({
  layer,
  palette,
  lockRatio,
  setLockRatio,
  patch,
  onAlign,
  onDuplicate,
  onDelete,
  onPickImage,
}: {
  layer: BannerLayer;
  palette: string[];
  lockRatio: boolean;
  setLockRatio: (value: boolean) => void;
  patch: (patch: Partial<BannerLayer>, key?: string) => void;
  onAlign: (axis: Align) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onPickImage: (fillId: string) => void;
}) {
  const isText = layer.type === "text";
  // Independent corners are on whenever the layer has its own per-corner values (follows the selected layer)
  const corners = layer.radius_tl !== undefined || layer.radius_tr !== undefined || layer.radius_br !== undefined || layer.radius_bl !== undefined;
  const single = fontIsSingleStyle(layer.font_family);
  const [effectMenu, setEffectMenu] = useState(false);
  const typeLabel = isText ? "Text" : layer.type === "ellipse" ? "Ellipse" : layer.fills.some((fill) => fill.type === "image") ? "Image" : "Rectangle";

  const setWidth = (value: number) => {
    if (lockRatio) patch({ width: value, height: Math.max(1, Math.round((value * layer.height) / layer.width)) }, "w");
    else patch({ width: value }, "w");
  };
  const setHeight = (value: number) => {
    if (lockRatio) patch({ height: value, width: Math.max(1, Math.round((value * layer.width) / layer.height)) }, "h");
    else patch({ height: value }, "h");
  };

  const toggleCorners = () => {
    if (corners) patch({ radius: layer.radius_tl ?? layer.radius, radius_tl: undefined, radius_tr: undefined, radius_br: undefined, radius_bl: undefined });
    else patch({ radius_tl: layer.radius, radius_tr: layer.radius, radius_br: layer.radius, radius_bl: layer.radius });
  };

  const updateFills = (next: BannerFill[]) => patch({ fills: next });
  const updateStrokes = (next: BannerStroke[]) => patch({ strokes: next });
  const updateEffects = (next: BannerEffect[]) => patch({ effects: next });

  return (
    <>
      <div className="flex h-11 items-center justify-between px-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <input className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-white outline-none" value={layer.name} onChange={(event) => patch({ name: event.target.value }, "name")} title={typeLabel} />
        <IconButton title="Duplicate (Ctrl+D)" onClick={onDuplicate}><CopyIcon className="h-4 w-4" /></IconButton>
        <IconButton title="Delete" onClick={onDelete}><XIcon className="h-4 w-4" /></IconButton>
      </div>

      <Section title="Position">
        <Label>Alignment</Label>
        <AlignRow onAlign={onAlign} />
        <Label>Position</Label>
        <div className="flex gap-2">
          <NumInput prefix="X" value={layer.x} onChange={(value) => patch({ x: value }, "x")} />
          <NumInput prefix="Y" value={layer.y} onChange={(value) => patch({ y: value }, "y")} />
        </div>
        <Label>Rotation</Label>
        <div className="flex items-center gap-2">
          <NumInput prefix="∠" suffix="°" value={layer.rotation} min={-360} max={360} onChange={(value) => patch({ rotation: value }, "rot")} />
          <div className="flex gap-0.5">
            <IconButton title="Flip horizontal" active={layer.flip_x} onClick={() => patch({ flip_x: !layer.flip_x })}><FlipHorizontal2Icon className="h-4 w-4" /></IconButton>
            <IconButton title="Flip vertical" active={layer.flip_y} onClick={() => patch({ flip_y: !layer.flip_y })}><FlipVertical2Icon className="h-4 w-4" /></IconButton>
          </div>
        </div>
      </Section>

      <Section title="Layout">
        <Label>Dimensions</Label>
        <div className="flex items-center gap-2">
          <NumInput prefix="W" value={layer.width} min={1} max={6000} onChange={setWidth} />
          <NumInput prefix="H" value={layer.height} min={1} max={6000} onChange={setHeight} />
          <IconButton title={lockRatio ? "Unlock proportions" : "Lock proportions"} active={lockRatio} onClick={() => setLockRatio(!lockRatio)}>
            {lockRatio ? <LinkIcon className="h-4 w-4" /> : <UnlinkIcon className="h-4 w-4" />}
          </IconButton>
        </div>
      </Section>

      {isText && (
        <Section title="Typography">
          <SelectInput value={layer.font_family} onChange={(value) => patch({ font_family: value, ...(fontIsSingleStyle(value) ? { font_weight: "normal", font_style: "normal" } : {}) })}>
            {BANNER_FONTS.map((font) => (
              <option key={font.family} value={font.family}>{font.family}</option>
            ))}
          </SelectInput>
          <div className="flex gap-2">
            <NumInput prefix="Aa" value={layer.font_size} min={6} max={400} onChange={(value) => patch({ font_size: value }, "fs")} />
            <NumInput prefix="↕" suffix="%" value={layer.line_height} min={60} max={300} onChange={(value) => patch({ line_height: value }, "lh")} />
          </div>
          <div className="flex gap-2">
            <NumInput prefix="|A|" value={layer.letter_spacing} min={-20} max={100} onChange={(value) => patch({ letter_spacing: value }, "ls")} />
            <div className="flex flex-1 gap-0.5">
              <IconButton title="Bold" active={layer.font_weight === "bold"} disabled={single} onClick={() => patch({ font_weight: layer.font_weight === "bold" ? "normal" : "bold" })}><BoldIcon className="h-4 w-4" /></IconButton>
              <IconButton title="Italic" active={layer.font_style === "italic"} disabled={single} onClick={() => patch({ font_style: layer.font_style === "italic" ? "normal" : "italic" })}><ItalicIcon className="h-4 w-4" /></IconButton>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-0.5">
              {(["left", "center", "right"] as const).map((align) => (
                <IconButton key={align} title={`Align ${align}`} active={layer.text_align === align} onClick={() => patch({ text_align: align })}>
                  <span className="text-[10px] font-semibold">{align[0].toUpperCase()}</span>
                </IconButton>
              ))}
            </div>
            <div className="flex gap-0.5">
              {(["top", "middle", "bottom"] as const).map((align) => (
                <IconButton key={align} title={`Vertical ${align}`} active={layer.text_vertical_align === align} onClick={() => patch({ text_vertical_align: align })}>
                  <span className="text-[10px] font-semibold">{align[0].toUpperCase()}</span>
                </IconButton>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-white">
            <input type="checkbox" checked={layer.text_wrap} onChange={(event) => patch({ text_wrap: event.target.checked })} />
            Wrap text inside the box
          </label>
          <textarea
            rows={4}
            value={layer.text}
            onChange={(event) => patch({ text: event.target.value }, "text")}
            className="w-full resize-y rounded-md border border-transparent p-2 text-[11px] text-white outline-none focus:border-[#0d99ff]"
            style={{ background: FIELD }}
          />
          <p className="text-[10px] text-[#6b6b6b]">Double-click text on the canvas to edit it there. You can use {"${guildname}"} and {"${guildmembercount}"}.</p>
        </Section>
      )}

      <Section title="Appearance">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label>Opacity</Label>
            <NumInput prefix="◐" suffix="%" value={layer.opacity} min={0} max={100} onChange={(value) => patch({ opacity: value }, "opacity")} />
          </div>
          {!isText && layer.type === "rectangle" && (
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>Corner radius</Label>
              <div className="flex items-center gap-1">
                {corners && [layer.radius_tr, layer.radius_br, layer.radius_bl].some((value) => (value ?? layer.radius) !== (layer.radius_tl ?? layer.radius)) ? (
                  <div className="flex h-7 min-w-0 flex-1 items-center rounded-md px-1.5 text-[11px] text-white" style={{ background: FIELD }}>
                    <span className="mr-1.5 flex w-4 shrink-0 justify-center text-[#8c8c8c]">◜</span>Mixed
                  </div>
                ) : (
                  <NumInput prefix="◜" value={layer.radius_tl ?? layer.radius} min={0} max={5000} onChange={(value) => patch(corners ? { radius: value, radius_tl: value, radius_tr: value, radius_br: value, radius_bl: value } : { radius: value }, "radius")} />
                )}
                <IconButton title="Independent corners" active={corners} onClick={toggleCorners}><SquareIcon className="h-3.5 w-3.5" /></IconButton>
              </div>
            </div>
          )}
        </div>
        {!isText && layer.type === "rectangle" && corners && (
          <div className="grid grid-cols-2 gap-2">
            <NumInput prefix="◜" value={layer.radius_tl ?? layer.radius} min={0} max={5000} onChange={(value) => patch({ radius_tl: value }, "tl")} />
            <NumInput prefix="◝" value={layer.radius_tr ?? layer.radius} min={0} max={5000} onChange={(value) => patch({ radius_tr: value }, "tr")} />
            <NumInput prefix="◟" value={layer.radius_bl ?? layer.radius} min={0} max={5000} onChange={(value) => patch({ radius_bl: value }, "bl")} />
            <NumInput prefix="◞" value={layer.radius_br ?? layer.radius} min={0} max={5000} onChange={(value) => patch({ radius_br: value }, "br")} />
          </div>
        )}
      </Section>

      <Section title="Fill" action={<IconButton title="Add fill" onClick={() => updateFills([...layer.fills, createFill("solid", { color: isText ? "#000000" : "#D9D9D9" })])}><PlusIcon className="h-4 w-4" /></IconButton>}>
        {[...layer.fills].reverse().map((fill) => (
          <FillRow
            key={fill.id}
            fill={fill}
            textOnly={isText}
            palette={palette}
            onChange={(next) => updateFills(layer.fills.map((entry) => (entry.id === fill.id ? next : entry)))}
            onRemove={() => updateFills(layer.fills.filter((entry) => entry.id !== fill.id))}
            onPickImage={() => onPickImage(fill.id)}
          />
        ))}
        {layer.fills.length === 0 && <p className="text-[10px] text-[#6b6b6b]">No fill.</p>}
      </Section>

      <Section title={isText ? "Outline" : "Stroke"} action={<IconButton title="Add stroke" onClick={() => updateStrokes([...layer.strokes, createStroke({ position: isText ? "outside" : "inside" })])}><PlusIcon className="h-4 w-4" /></IconButton>}>
        {layer.strokes.map((stroke) => (
          <StrokeRow
            key={stroke.id}
            stroke={stroke}
            textOnly={isText}
            palette={palette}
            onChange={(next) => updateStrokes(layer.strokes.map((entry) => (entry.id === stroke.id ? next : entry)))}
            onRemove={() => updateStrokes(layer.strokes.filter((entry) => entry.id !== stroke.id))}
          />
        ))}
      </Section>

      <Section
        title="Effects"
        action={
          <div className="relative">
            <IconButton title="Add effect" onClick={() => setEffectMenu((open) => !open)}><PlusIcon className="h-4 w-4" /></IconButton>
            {effectMenu && (
              <div className="absolute bottom-8 right-0 z-10 w-44 rounded-lg py-1 shadow-xl" style={{ background: "#1e1e1e", border: `1px solid ${BORDER}` }}>
                {(Object.keys(EFFECT_LABELS) as BannerEffectType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      updateEffects([...layer.effects, createEffect(type)]);
                      setEffectMenu(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[11px] text-white hover:bg-white/10"
                  >
                    {EFFECT_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      >
        {layer.effects.map((effect) => (
          <EffectRow
            key={effect.id}
            effect={effect}
            palette={palette}
            onChange={(next) => updateEffects(layer.effects.map((entry) => (entry.id === effect.id ? next : entry)))}
            onRemove={() => updateEffects(layer.effects.filter((entry) => entry.id !== effect.id))}
          />
        ))}
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ colour picker (Figma style)

type Hsv = { h: number; s: number; v: number };

const normalizeHex = (value: string): string | null => {
  const text = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(text)) return `#${text.split("").map((c) => c + c).join("")}`.toUpperCase();
  if (/^[0-9a-f]{6}$/i.test(text)) return `#${text}`.toUpperCase();
  return null;
};

function hexToHsv(hex: string): Hsv {
  const normalized = normalizeHex(hex) ?? "#000000";
  const r = parseInt(normalized.slice(1, 3), 16) / 255;
  const g = parseInt(normalized.slice(3, 5), 16) / 255;
  const b = parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);
  let h = 0;
  if (delta) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? delta / max : 0, v: max };
}

function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const part = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

// Press and drag inside an element: reports the pointer position as 0..1 on both axes
function dragIn(event: ReactPointerEvent<HTMLElement>, onMove: (x: number, y: number) => void) {
  event.preventDefault();
  const element = event.currentTarget;
  const apply = (clientX: number, clientY: number) => {
    const rect = element.getBoundingClientRect();
    onMove(clamp((clientX - rect.left) / rect.width, 0, 1), clamp((clientY - rect.top) / rect.height, 0, 1));
  };
  apply(event.clientX, event.clientY);
  const move = (moveEvent: PointerEvent) => apply(moveEvent.clientX, moveEvent.clientY);
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
}

const CHECKER = "repeating-conic-gradient(#555 0% 25%, #888 0% 50%) 50% / 8px 8px";

function ColorPicker({ color, opacity, onColor, onOpacity }: { color: string; opacity: number; onColor: (hex: string) => void; onOpacity: (value: number) => void }) {
  const hex = normalizeHex(color) ?? "#000000";
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(color));
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  useEffect(() => {
    // The colour changed from outside (palette swatch, hex field): follow it, but keep the hue for greys
    setHsv((current) => {
      if (hsvToHex(current) === hex) return current;
      const next = hexToHsv(hex);
      return next.s === 0 || next.v === 0 ? { ...next, h: current.h } : next;
    });
  }, [hex]);

  const change = (next: Hsv) => {
    setHsv(next);
    onColor(hsvToHex(next));
  };

  return (
    <div className="space-y-3">
      <div
        onPointerDown={(event) => dragIn(event, (x, y) => change({ ...hsv, s: x, v: 1 - y }))}
        className="relative h-44 cursor-crosshair rounded-md"
        style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h}, 100%, 50%))` }}
      >
        <div
          className="pointer-events-none absolute h-3.5 w-3.5 rounded-full"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, transform: "translate(-50%, -50%)", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.45)", background: hex }}
        />
      </div>

      <div className="space-y-2.5 px-0.5">
        <div
          onPointerDown={(event) => dragIn(event, (x) => change({ ...hsv, h: x * 360 }))}
          className="relative h-3 cursor-pointer rounded-full"
          style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
        >
          <div className="pointer-events-none absolute top-1/2 h-4 w-4 rounded-full" style={{ left: `${(hsv.h / 360) * 100}%`, transform: "translate(-50%, -50%)", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.45)", background: `hsl(${hsv.h}, 100%, 50%)` }} />
        </div>
        <div onPointerDown={(event) => dragIn(event, (x) => onOpacity(Math.round(x * 100)))} className="relative h-3 cursor-pointer rounded-full" style={{ background: CHECKER }}>
          <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(to right, transparent, ${hex})` }} />
          <div className="pointer-events-none absolute top-1/2 h-4 w-4 rounded-full" style={{ left: `${opacity}%`, transform: "translate(-50%, -50%)", border: "2px solid #fff", boxShadow: "0 0 0 1px rgba(0,0,0,0.45)", background: withAlpha(hex, opacity) }} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-7 w-14 shrink-0 items-center rounded-md px-2 text-[11px] text-[#8c8c8c]" style={{ background: FIELD }}>Hex</div>
        <input
          className="h-7 min-w-0 flex-1 rounded-md border border-transparent px-2 text-[11px] uppercase text-white outline-none focus:border-[#0d99ff]"
          style={{ background: FIELD }}
          value={hexDraft ?? hex.replace("#", "")}
          spellCheck={false}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            setHexDraft(event.target.value);
            const parsed = normalizeHex(event.target.value);
            if (parsed) onColor(parsed);
          }}
          onBlur={() => setHexDraft(null)}
        />
        <div className="w-[68px] shrink-0">
          <NumInput suffix="%" value={opacity} min={0} max={100} onChange={onOpacity} />
        </div>
      </div>
    </div>
  );
}

// A panel that floats to the left of the Design panel, like Figma's pickers
function FloatingPanel({ anchor, onClose, children, width = 248 }: { anchor: HTMLElement | null; onClose: () => void; children: ReactNode; width?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [top, setTop] = useState(80);

  useEffect(() => {
    const place = () => {
      if (!anchor || !ref.current) return;
      const rect = anchor.getBoundingClientRect();
      setTop(clamp(rect.top - 40, 8, Math.max(8, window.innerHeight - ref.current.offsetHeight - 8)));
    };
    place();
    const observer = new ResizeObserver(place);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [anchor]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [anchor, onClose]);

  return (
    <div ref={ref} className="fixed z-[70] rounded-xl p-3 shadow-2xl" style={{ right: 276, top, width, background: PANEL, border: `1px solid ${BORDER}` }}>
      {children}
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-white" style={{ background: "rgba(255,255,255,0.1)" }}>Custom</span>
      <IconButton title="Close" onClick={onClose}><XIcon className="h-4 w-4" /></IconButton>
    </div>
  );
}

function PaletteRow({ palette, onPick }: { palette: string[]; onPick: (hex: string) => void }) {
  if (palette.length === 0) return null;
  return (
    <div className="mt-3 border-t pt-3" style={{ borderColor: BORDER }}>
      <p className="mb-2 text-[11px] text-[#8c8c8c]">On this page</p>
      <div className="flex flex-wrap gap-1.5">
        {palette.map((swatch) => (
          <button key={swatch} type="button" title={swatch} onClick={() => onPick(swatch)} className="h-5 w-5 rounded-sm border border-white/25" style={{ background: swatch }} />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ list rows (Fill / Stroke / Effects)

function Swatch({ background }: { background: string }) {
  return <span className="block h-5 w-5 shrink-0 rounded border border-white/25" style={{ background }} />;
}

function HexField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      className="h-7 min-w-0 flex-1 rounded-md border border-transparent px-2 text-[11px] uppercase text-white outline-none hover:border-[#4d4d4d] focus:border-[#0d99ff]"
      style={{ background: FIELD }}
      value={draft ?? value.replace("#", "")}
      spellCheck={false}
      onFocus={(event) => event.target.select()}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = normalizeHex(event.target.value);
        if (parsed) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

function RowEnd({ visible, onToggle, onRemove }: { visible: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <>
      <IconButton title={visible ? "Hide" : "Show"} onClick={onToggle}>{visible ? <EyeIcon className="h-3.5 w-3.5" /> : <EyeOffIcon className="h-3.5 w-3.5" />}</IconButton>
      <IconButton title="Remove" onClick={onRemove}><MinusIcon className="h-3.5 w-3.5" /></IconButton>
    </>
  );
}

function FillPopover({
  fill,
  textOnly,
  palette,
  anchor,
  onChange,
  onPickImage,
  onClose,
}: {
  fill: BannerFill;
  textOnly: boolean;
  palette: string[];
  anchor: HTMLElement | null;
  onChange: (fill: BannerFill) => void;
  onPickImage: () => void;
  onClose: () => void;
}) {
  const [stop, setStop] = useState<"color" | "color2">("color");
  const image = useFillImage(fill);
  const types: Array<[BannerFill["type"], string, ReactNode]> = [
    ["solid", "Solid", <SquareIcon key="s" className="h-4 w-4" />],
    ["gradient", "Linear gradient", <BlendIcon key="g" className="h-4 w-4" />],
    ["image", "Image", <ImageIcon key="i" className="h-4 w-4" />],
  ];

  return (
    <FloatingPanel anchor={anchor} onClose={onClose}>
      <PanelHeader onClose={onClose} />
      {!textOnly && (
        <div className="mb-3 flex gap-1 border-b pb-3" style={{ borderColor: BORDER }}>
          {types.map(([type, title, icon]) => (
            <IconButton key={type} title={title} active={fill.type === type} onClick={() => onChange({ ...fill, type })}>{icon}</IconButton>
          ))}
        </div>
      )}

      {fill.type === "solid" && (
        <>
          <ColorPicker color={fill.color} opacity={fill.opacity} onColor={(hex) => onChange({ ...fill, color: hex })} onOpacity={(value) => onChange({ ...fill, opacity: value })} />
          <PaletteRow palette={palette} onPick={(hex) => onChange({ ...fill, color: hex })} />
        </>
      )}

      {fill.type === "gradient" && (
        <div className="space-y-3">
          <div className="relative h-5 rounded-md" style={{ background: `linear-gradient(90deg, ${fill.color}, ${fill.color2})` }}>
            {(["color", "color2"] as const).map((which, index) => (
              <button
                key={which}
                type="button"
                title={index === 0 ? "Start colour" : "End colour"}
                onClick={() => setStop(which)}
                className="absolute top-1/2 h-4 w-4 rounded-sm"
                style={{ left: index === 0 ? 0 : "100%", transform: "translate(-50%, -50%)", background: fill[which], border: `2px solid ${stop === which ? ACCENT : "#fff"}` }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <NumInput prefix="∠" suffix="°" value={fill.angle} min={-360} max={360} onChange={(value) => onChange({ ...fill, angle: value })} />
            <button type="button" onClick={() => onChange({ ...fill, color: fill.color2, color2: fill.color })} className="h-7 shrink-0 rounded-md px-2.5 text-[11px] text-white" style={{ background: FIELD }}>Swap</button>
          </div>
          <ColorPicker color={fill[stop]} opacity={fill.opacity} onColor={(hex) => onChange({ ...fill, [stop]: hex })} onOpacity={(value) => onChange({ ...fill, opacity: value })} />
          <PaletteRow palette={palette} onPick={(hex) => onChange({ ...fill, [stop]: hex })} />
        </div>
      )}

      {fill.type === "image" && (
        <div className="space-y-2.5">
          <div className="h-24 overflow-hidden rounded-md" style={{ background: image.url ? `url(${image.url}) center / cover` : CHECKER }} />
          <SelectInput value={fill.source} onChange={(value) => onChange({ ...fill, source: value as BannerFill["source"] })}>
            <option value="url">Image link or upload</option>
            <option value="roblox_cover">Roblox game cover photo</option>
            <option value="roblox_icon">Roblox game icon</option>
          </SelectInput>
          {fill.source === "url" ? (
            <>
              <TextInput value={fill.url} placeholder="https://..." onChange={(value) => onChange({ ...fill, url: value })} />
              <button type="button" onClick={onPickImage} className="h-7 w-full rounded-md text-[11px] text-white" style={{ background: FIELD }}>Choose from uploaded images</button>
            </>
          ) : (
            <>
              <TextInput value={fill.game_id} placeholder="Game ID (same as game.GameId)" onChange={(value) => onChange({ ...fill, game_id: value.replace(/\D/g, "") })} />
              <p className="text-[10px] leading-relaxed text-[#8c8c8c]">
                {!fill.game_id
                  ? "Type the game's ID. The bot looks up its current picture every time the banner is made."
                  : image.pending
                  ? "Looking up the game..."
                  : image.url
                  ? `Found: ${image.name || "game"}`
                  : "No game found with that ID."}
              </p>
            </>
          )}
          <SelectInput value={fill.fit} onChange={(value) => onChange({ ...fill, fit: value as BannerFill["fit"] })}>
            <option value="cover">Fill (crop to fit)</option>
            <option value="contain">Fit (whole image)</option>
            <option value="stretch">Stretch</option>
          </SelectInput>
          <NumInput prefix="◐" suffix="%" value={fill.opacity} min={0} max={100} onChange={(value) => onChange({ ...fill, opacity: value })} />
        </div>
      )}
    </FloatingPanel>
  );
}

function FillRow({ fill, textOnly, palette, onChange, onRemove, onPickImage }: { fill: BannerFill; textOnly: boolean; palette: string[]; onChange: (fill: BannerFill) => void; onRemove: () => void; onPickImage: () => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const image = useFillImage(fill);
  const label =
    fill.type === "gradient"
      ? "Linear"
      : fill.source === "roblox_cover"
      ? "Game cover"
      : fill.source === "roblox_icon"
      ? "Game icon"
      : "Image";
  const swatch = fill.type === "gradient" ? `linear-gradient(90deg, ${fill.color}, ${fill.color2})` : fill.type === "image" ? (image.url ? `url(${image.url}) center / cover` : CHECKER) : fill.color;

  return (
    <div>
      <div className="flex h-8 items-center gap-1.5">
        <button ref={setAnchor} type="button" title="Edit fill" onClick={() => setOpen((value) => !value)}><Swatch background={swatch} /></button>
        {fill.type === "solid" ? (
          <HexField value={fill.color} onChange={(hex) => onChange({ ...fill, color: hex })} />
        ) : (
          <button type="button" onClick={() => setOpen((value) => !value)} className="h-7 min-w-0 flex-1 truncate rounded-md px-2 text-left text-[11px] text-white" style={{ background: FIELD }}>{label}</button>
        )}
        <div className="w-[60px] shrink-0">
          <NumInput suffix="%" value={fill.opacity} min={0} max={100} onChange={(value) => onChange({ ...fill, opacity: value })} />
        </div>
        <RowEnd visible={fill.visible} onToggle={() => onChange({ ...fill, visible: !fill.visible })} onRemove={onRemove} />
      </div>
      {open && <FillPopover fill={fill} textOnly={textOnly} palette={palette} anchor={anchor} onChange={onChange} onPickImage={onPickImage} onClose={() => setOpen(false)} />}
    </div>
  );
}

function StrokeRow({ stroke, textOnly, palette, onChange, onRemove }: { stroke: BannerStroke; textOnly: boolean; palette: string[]; onChange: (stroke: BannerStroke) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <div className="space-y-1.5">
      <div className="flex h-8 items-center gap-1.5">
        <button ref={setAnchor} type="button" title="Edit stroke colour" onClick={() => setOpen((value) => !value)}><Swatch background={stroke.color} /></button>
        <HexField value={stroke.color} onChange={(hex) => onChange({ ...stroke, color: hex })} />
        <div className="w-[60px] shrink-0">
          <NumInput suffix="%" value={stroke.opacity} min={0} max={100} onChange={(value) => onChange({ ...stroke, opacity: value })} />
        </div>
        <RowEnd visible={stroke.visible} onToggle={() => onChange({ ...stroke, visible: !stroke.visible })} onRemove={onRemove} />
      </div>
      <div className="flex gap-2">
        {!textOnly && (
          <SelectInput value={stroke.position} onChange={(value) => onChange({ ...stroke, position: value as BannerStroke["position"] })}>
            <option value="inside">Inside</option>
            <option value="center">Center</option>
            <option value="outside">Outside</option>
          </SelectInput>
        )}
        <NumInput prefix="▭" value={stroke.width} min={0} max={40} onChange={(value) => onChange({ ...stroke, width: value })} />
      </div>
      {open && (
        <FloatingPanel anchor={anchor} onClose={() => setOpen(false)}>
          <PanelHeader onClose={() => setOpen(false)} />
          <ColorPicker color={stroke.color} opacity={stroke.opacity} onColor={(hex) => onChange({ ...stroke, color: hex })} onOpacity={(value) => onChange({ ...stroke, opacity: value })} />
          <PaletteRow palette={palette} onPick={(hex) => onChange({ ...stroke, color: hex })} />
        </FloatingPanel>
      )}
    </div>
  );
}

function EffectRow({ effect, palette, onChange, onRemove }: { effect: BannerEffect; palette: string[]; onChange: (effect: BannerEffect) => void; onRemove: () => void }) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const isShadow = effect.type === "drop_shadow" || effect.type === "inner_shadow";
  return (
    <div>
      <div className="flex h-8 items-center gap-1.5">
        <button
          ref={setAnchor}
          type="button"
          title="Effect settings"
          onClick={() => setOpen((value) => !value)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-white/25"
          style={{ background: isShadow ? withAlpha(effect.color, Math.max(effect.opacity, 35)) : "linear-gradient(90deg, #888, transparent)" }}
        />
        <div className="min-w-0 flex-1">
          <SelectInput value={effect.type} onChange={(value) => onChange({ ...effect, type: value as BannerEffectType })}>
            {(Object.keys(EFFECT_LABELS) as BannerEffectType[]).map((type) => (
              <option key={type} value={type}>{EFFECT_LABELS[type]}</option>
            ))}
          </SelectInput>
        </div>
        <RowEnd visible={effect.visible} onToggle={() => onChange({ ...effect, visible: !effect.visible })} onRemove={onRemove} />
      </div>
      {open && (
        <FloatingPanel anchor={anchor} onClose={() => setOpen(false)}>
          <PanelHeader onClose={() => setOpen(false)} />
          <div className="space-y-2.5">
            {isShadow && (
              <div className="flex gap-2">
                <NumInput prefix="X" value={effect.x} min={-400} max={400} onChange={(value) => onChange({ ...effect, x: value })} />
                <NumInput prefix="Y" value={effect.y} min={-400} max={400} onChange={(value) => onChange({ ...effect, y: value })} />
              </div>
            )}
            <NumInput prefix="B" value={effect.blur} min={0} max={200} onChange={(value) => onChange({ ...effect, blur: value })} />
            {isShadow && (
              <>
                <ColorPicker color={effect.color} opacity={effect.opacity} onColor={(hex) => onChange({ ...effect, color: hex })} onOpacity={(value) => onChange({ ...effect, opacity: value })} />
                <PaletteRow palette={palette} onPick={(hex) => onChange({ ...effect, color: hex })} />
              </>
            )}
          </div>
        </FloatingPanel>
      )}
    </div>
  );
}
