// Free-form banner designer: data model, defaults, templates and the pure geometry used by the editor.
// Layers are rendered by the bot (modules/banner_render.py); every field here is read there too.

export type BannerLayerType = "rectangle" | "ellipse" | "text";
export type BannerHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
export type BannerFillType = "solid" | "gradient" | "image";
// Where an image fill comes from: a link, or a Roblox game's cover photo / icon looked up by game ID
export type BannerImageSource = "url" | "roblox_cover" | "roblox_icon";
export type BannerStrokePosition = "inside" | "center" | "outside";
export type BannerEffectType = "drop_shadow" | "inner_shadow" | "layer_blur" | "background_blur";

// Fills are drawn bottom -> top in array order (the panel lists them top first, like Figma).
export interface BannerFill {
  id: string;
  type: BannerFillType;
  visible: boolean;
  opacity: number;
  color: string; // solid colour / gradient start
  color2: string; // gradient end
  angle: number; // gradient angle, CSS semantics
  url: string; // image fill
  fit: "cover" | "contain" | "stretch";
  source: BannerImageSource;
  game_id: string; // Roblox universe ID (the same number as game.GameId), for the Roblox sources
}

export interface BannerStroke {
  id: string;
  visible: boolean;
  color: string;
  opacity: number;
  width: number;
  position: BannerStrokePosition;
}

export interface BannerEffect {
  id: string;
  type: BannerEffectType;
  visible: boolean;
  color: string;
  opacity: number;
  x: number;
  y: number;
  blur: number;
}

export interface BannerLayer {
  id: string;
  name: string;
  type: BannerLayerType;
  v2: true; // marks layers that use the new renderer
  enabled: boolean;
  locked: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  flip_x: boolean;
  flip_y: boolean;
  radius: number;
  radius_tl?: number;
  radius_tr?: number;
  radius_br?: number;
  radius_bl?: number;
  fills: BannerFill[];
  strokes: BannerStroke[];
  effects: BannerEffect[];
  text: string;
  font_family: string;
  font_size: number;
  font_weight: "normal" | "bold";
  font_style: "normal" | "italic";
  text_align: "left" | "center" | "right";
  text_vertical_align: "top" | "middle" | "bottom";
  line_height: number;
  letter_spacing: number;
  text_wrap: boolean;
}

export interface BannerDesign {
  id: string;
  name: string;
  width: number;
  height: number;
  background_color: string; // kept for compatibility; the bot renders on a transparent canvas
  output_scale?: number; // set only for exports
  layers: BannerLayer[];
}

// Fonts the bot has files for (assets/fonts). "single" families have one style only.
export const BANNER_FONTS = [
  { family: "Poppins", single: false },
  { family: "Lato", single: false },
  { family: "Bebas Neue", single: true },
  { family: "Anton", single: true },
  { family: "Pacifico", single: true },
] as const;

export const BANNER_FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;1,400;1,700&family=Lato:ital,wght@0,400;0,700;1,400;1,700&family=Bebas+Neue&family=Anton&family=Pacifico&display=swap";

export const EFFECT_LABELS: Record<BannerEffectType, string> = {
  inner_shadow: "Inner shadow",
  drop_shadow: "Drop shadow",
  layer_blur: "Layer blur",
  background_blur: "Background blur",
};

export const fontIsSingleStyle = (family: string) => BANNER_FONTS.find((font) => font.family === family)?.single ?? false;

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function toNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

export function uid(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// ---------------------------------------------------------------- factories

export function createFill(type: BannerFillType = "solid", overrides: Partial<BannerFill> = {}): BannerFill {
  return {
    id: uid("fill"),
    type,
    visible: true,
    opacity: 100,
    color: type === "gradient" ? "#FFFFFF" : "#D9D9D9",
    color2: "#5865F2",
    angle: 90,
    url: "",
    fit: "cover",
    source: "url",
    game_id: "",
    ...overrides,
  };
}

export function createStroke(overrides: Partial<BannerStroke> = {}): BannerStroke {
  return { id: uid("stroke"), visible: true, color: "#000000", opacity: 100, width: 1, position: "inside", ...overrides };
}

export function createEffect(type: BannerEffectType, overrides: Partial<BannerEffect> = {}): BannerEffect {
  const shadow = type === "drop_shadow" || type === "inner_shadow";
  return {
    id: uid("effect"),
    type,
    visible: true,
    color: "#000000",
    opacity: shadow ? 25 : 100,
    x: 0,
    y: shadow ? 4 : 0,
    blur: shadow ? 4 : 8,
    ...overrides,
  };
}

const LAYER_DEFAULTS: Omit<BannerLayer, "id" | "name" | "type" | "fills"> = {
  v2: true,
  enabled: true,
  locked: false,
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  rotation: 0,
  opacity: 100,
  flip_x: false,
  flip_y: false,
  radius: 0,
  strokes: [],
  effects: [],
  text: "",
  font_family: "Poppins",
  font_size: 22,
  font_weight: "normal",
  font_style: "normal",
  text_align: "left",
  text_vertical_align: "top",
  line_height: 120,
  letter_spacing: 0,
  text_wrap: true,
};

export function createBannerLayer(type: BannerLayerType, overrides: Partial<BannerLayer> = {}): BannerLayer {
  const label = type === "text" ? "Text" : type === "ellipse" ? "Ellipse" : "Rectangle";
  const typeDefaults: Partial<BannerLayer> =
    type === "text" ? { text: "Text", width: 160, height: 40, font_size: 28 } : { width: 140, height: 100 };
  return {
    ...LAYER_DEFAULTS,
    ...typeDefaults,
    id: uid("layer"),
    name: label,
    type,
    fills: [createFill("solid", { color: type === "text" ? "#000000" : "#D9D9D9" })],
    ...overrides,
  };
}

// ---------------------------------------------------------------- normalising saved data (also migrates the first version)

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);

const cornerValue = (value: unknown): number | undefined =>
  value === undefined || value === null || value === "" ? undefined : toNumber(value, 0, 0, 5000);

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

function normalizeFill(raw: unknown): BannerFill | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const type = pick(entry.type, ["solid", "gradient", "image"] as const, "solid");
  const base = createFill(type);
  return {
    ...base,
    id: str(entry.id, "") || base.id,
    visible: entry.visible !== false,
    opacity: toNumber(entry.opacity, 100, 0, 100),
    color: str(entry.color, base.color),
    color2: str(entry.color2, base.color2),
    angle: toNumber(entry.angle, 90, -360, 360),
    url: str(entry.url, ""),
    fit: pick(entry.fit, ["cover", "contain", "stretch"] as const, "cover"),
    source: pick(entry.source, ["url", "roblox_cover", "roblox_icon"] as const, "url"),
    game_id: str(entry.game_id, "").replace(/\D/g, ""),
  };
}

function normalizeStroke(raw: unknown): BannerStroke | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const base = createStroke();
  return {
    ...base,
    id: str(entry.id, "") || base.id,
    visible: entry.visible !== false,
    color: str(entry.color, base.color),
    opacity: toNumber(entry.opacity, 100, 0, 100),
    width: toNumber(entry.width, 1, 0, 40),
    position: pick(entry.position, ["inside", "center", "outside"] as const, "inside"),
  };
}

function normalizeEffect(raw: unknown): BannerEffect | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const type = pick(entry.type, ["drop_shadow", "inner_shadow", "layer_blur", "background_blur"] as const, "drop_shadow");
  const base = createEffect(type);
  return {
    ...base,
    id: str(entry.id, "") || base.id,
    visible: entry.visible !== false,
    color: str(entry.color, base.color),
    opacity: toNumber(entry.opacity, base.opacity, 0, 100),
    x: toNumber(entry.x, base.x, -400, 400),
    y: toNumber(entry.y, base.y, -400, 400),
    blur: toNumber(entry.blur, base.blur, 0, 200),
  };
}

const list = <T,>(value: unknown, map: (item: unknown) => T | null): T[] =>
  (Array.isArray(value) ? value : []).map(map).filter((item): item is T => item !== null);

// The first version stored one colour / stroke / shadow per layer; turn those into the lists.
function legacyLists(entry: Record<string, unknown>, isText: boolean, isImage: boolean) {
  let fills: BannerFill[];
  if (isImage) {
    fills = [createFill("image", { url: str(entry.image_url, ""), fit: pick(entry.image_fit, ["cover", "contain", "stretch"] as const, "cover") })];
  } else if (entry.fill_mode === "gradient" && !isText) {
    fills = [createFill("gradient", { color: str(entry.color, "#FFFFFF"), color2: str(entry.gradient_color, "#5865F2"), angle: toNumber(entry.gradient_angle, 90, -360, 360) })];
  } else {
    fills = [createFill("solid", { color: str(entry.color, isText ? "#000000" : "#D9D9D9") })];
  }
  const strokes: BannerStroke[] =
    toNumber(entry.stroke_width, 0, 0, 40) > 0
      ? [createStroke({ width: toNumber(entry.stroke_width, 1, 0, 40), color: str(entry.stroke_color, "#FFFFFF"), opacity: toNumber(entry.stroke_opacity, 100, 0, 100) })]
      : [];
  const effects: BannerEffect[] =
    toNumber(entry.shadow_opacity, 0, 0, 100) > 0
      ? [createEffect("drop_shadow", {
          color: str(entry.shadow_color, "#000000"),
          opacity: toNumber(entry.shadow_opacity, 50, 0, 100),
          x: toNumber(entry.shadow_x, 0, -400, 400),
          y: toNumber(entry.shadow_y, 4, -400, 400),
          blur: toNumber(entry.shadow_blur, 8, 0, 200),
        })]
      : [];
  return { fills, strokes, effects };
}

export function normalizeBannerLayer(raw: unknown, index: number): BannerLayer | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const legacyType = String(entry.type || "");
  const type: BannerLayerType =
    legacyType === "text" ? "text" : legacyType === "ellipse" ? "ellipse" : "rectangle";
  const base = createBannerLayer(type);
  const lists = Array.isArray(entry.fills)
    ? { fills: list(entry.fills, normalizeFill), strokes: list(entry.strokes, normalizeStroke), effects: list(entry.effects, normalizeEffect) }
    : legacyLists(entry, type === "text", legacyType === "logo" || legacyType === "image");
  return {
    ...base,
    ...lists,
    id: str(entry.id, "") || `layer-${index + 1}`,
    name: str(entry.name, "") || `Layer ${index + 1}`,
    type,
    enabled: entry.enabled !== false,
    locked: entry.locked === true,
    x: toNumber(entry.x, base.x, -6000, 12000),
    y: toNumber(entry.y, base.y, -6000, 12000),
    width: toNumber(entry.width, base.width, 1, 6000),
    height: toNumber(entry.height, base.height, 1, 6000),
    rotation: toNumber(entry.rotation, 0, -360, 360),
    opacity: toNumber(entry.opacity, 100, 0, 100),
    flip_x: entry.flip_x === true,
    flip_y: entry.flip_y === true,
    radius: toNumber(entry.radius, 0, 0, 5000),
    radius_tl: cornerValue(entry.radius_tl),
    radius_tr: cornerValue(entry.radius_tr),
    radius_br: cornerValue(entry.radius_br),
    radius_bl: cornerValue(entry.radius_bl),
    text: str(entry.text, base.text),
    font_family: BANNER_FONTS.some((font) => font.family === entry.font_family) ? (entry.font_family as string) : "Poppins",
    font_size: toNumber(entry.font_size, base.font_size, 6, 400),
    font_weight: pick(entry.font_weight, ["normal", "bold"] as const, "normal"),
    font_style: pick(entry.font_style, ["normal", "italic"] as const, "normal"),
    text_align: pick(entry.text_align, ["left", "center", "right"] as const, "left"),
    text_vertical_align: pick(entry.text_vertical_align, ["top", "middle", "bottom"] as const, "top"),
    line_height: toNumber(entry.line_height, 120, 60, 300),
    letter_spacing: toNumber(entry.letter_spacing, 0, -20, 100),
    text_wrap: entry.text_wrap !== false,
  };
}

export function normalizeBannerDesign(raw: unknown): BannerDesign | null {
  const entry = asRecord(raw);
  if (!entry) return null;
  const layers: BannerLayer[] = [];
  (Array.isArray(entry.layers) ? entry.layers : []).forEach((layer, index) => {
    const normalized = normalizeBannerLayer(layer, index);
    if (normalized) layers.push(normalized);
  });
  return {
    id: str(entry.id, "") || uid("banner"),
    name: str(entry.name, "") || "Announcement Banner",
    width: toNumber(entry.width, 800, 128, 4000),
    height: toNumber(entry.height, 300, 128, 4000),
    background_color: str(entry.background_color, "transparent"),
    layers,
  };
}

// ---------------------------------------------------------------- templates

const solid = (color: string, opacity = 100) => [createFill("solid", { color, opacity })];
const TEXT_BASE: Partial<BannerLayer> = { font_family: "Poppins", font_weight: "bold", font_style: "italic" };

// The "Update card" layout: header image, outlined title, grey body, logo and a white footer strip
export function createUpdateCardDesign(): BannerDesign {
  return {
    id: uid("banner"),
    name: "Update Card",
    width: 494,
    height: 505,
    background_color: "transparent",
    layers: [
      createBannerLayer("rectangle", {
        name: "Card", x: 44, y: 34, width: 406, height: 424, radius: 32, fills: solid("#FFFFFF"),
        effects: [createEffect("drop_shadow", { opacity: 55, x: 12, y: 12, blur: 4 })],
      }),
      createBannerLayer("rectangle", { name: "Body", x: 44, y: 108, width: 406, height: 314, fills: solid("#D9D9D9") }),
      createBannerLayer("rectangle", {
        name: "Header image", x: 44, y: 34, width: 406, height: 74, radius_tl: 32, radius_tr: 32, radius_br: 0, radius_bl: 0,
        fills: [createFill("image", { url: "" })],
      }),
      createBannerLayer("text", {
        ...TEXT_BASE, name: "Title", x: 56, y: 62, width: 380, height: 44, text: "${title}", font_size: 26,
        fills: solid("#FFFFFF"), strokes: [createStroke({ width: 3, color: "#222222", position: "outside" })],
        effects: [createEffect("drop_shadow", { opacity: 70, x: 2, y: 3, blur: 2 })], text_wrap: false,
      }),
      createBannerLayer("text", {
        ...TEXT_BASE, name: "Update text", x: 52, y: 114, width: 394, height: 246, fills: solid("#000000"),
        text: "${description}",
        font_size: 11.5, text_align: "center", line_height: 118,
      }),
      createBannerLayer("rectangle", { name: "Logo", x: 217, y: 368, width: 50, height: 50, fills: [createFill("image", { url: "" })] }),
      createBannerLayer("rectangle", {
        name: "Footer", x: 44, y: 422, width: 406, height: 36, radius_bl: 32, radius_br: 32, radius_tl: 0, radius_tr: 0, fills: solid("#FFFFFF"),
      }),
      createBannerLayer("text", {
        ...TEXT_BASE, name: "Footer text", x: 44, y: 422, width: 406, height: 36, fills: solid("#000000"),
        text: "${footer}", font_size: 11, text_align: "center",
        text_vertical_align: "middle", text_wrap: false,
      }),
    ],
  };
}

export function createBlankBanner(): BannerDesign {
  return {
    id: uid("banner"),
    name: "Announcement Banner",
    width: 800,
    height: 300,
    background_color: "transparent",
    layers: [
      createBannerLayer("rectangle", { name: "Card", x: 24, y: 24, width: 752, height: 252, radius: 28, fills: solid("#1F232B") }),
      createBannerLayer("text", {
        ...TEXT_BASE, name: "Title", x: 56, y: 90, width: 688, height: 70, text: "${title}", font_size: 48,
        font_style: "normal", fills: solid("#FFFFFF"), text_wrap: false,
      }),
      createBannerLayer("text", {
        name: "Subtitle", x: 56, y: 170, width: 688, height: 40, text: "${description}", font_size: 24,
        fills: solid("#D4D4D8"), text_wrap: false,
      }),
    ],
  };
}

export const BANNER_TEMPLATES = [
  { id: "update-card", label: "Update card", create: createUpdateCardDesign },
  { id: "blank", label: "Blank banner", create: createBlankBanner },
] as const;

// ---------------------------------------------------------------- colour + css helpers (match the bot)

export function withAlpha(color: string, percent: number): string {
  const text = String(color || "").trim();
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (!match) return text;
  let digits = match[1];
  if (digits.length === 3) digits = digits.split("").map((c) => c + c).join("");
  const r = parseInt(digits.slice(0, 2), 16);
  const g = parseInt(digits.slice(2, 4), 16);
  const b = parseInt(digits.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(percent, 0, 100) / 100})`;
}

export function layerRadii(layer: BannerLayer): [number, number, number, number] {
  const limit = Math.min(layer.width, layer.height) / 2;
  const corner = (value: number | undefined) => Math.min(limit, value ?? layer.radius);
  return [corner(layer.radius_tl), corner(layer.radius_tr), corner(layer.radius_br), corner(layer.radius_bl)];
}

// ---------------------------------------------------------------- geometry

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const HANDLE_VECTORS: Record<BannerHandle, [number, number]> = {
  nw: [-1, -1], n: [0, -1], ne: [1, -1], e: [1, 0], se: [1, 1], s: [0, 1], sw: [-1, 1], w: [-1, 0],
};

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

// Local -> world for a layer rotated clockwise (CSS rotate, y pointing down)
const toWorld = (x: number, y: number, degrees: number) => {
  const cos = Math.cos(toRadians(degrees));
  const sin = Math.sin(toRadians(degrees));
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

const toLocal = (x: number, y: number, degrees: number) => toWorld(x, y, -degrees);

// Drag a resize handle by (dx, dy) in canvas pixels; the opposite side stays where it is, also when rotated.
export function resizeBox(
  start: Box & { rotation: number },
  handle: BannerHandle,
  dx: number,
  dy: number,
  keepAspect: boolean,
  minSize = 4,
): Box {
  const [hx, hy] = HANDLE_VECTORS[handle];
  const centerX = start.x + start.width / 2;
  const centerY = start.y + start.height / 2;
  const anchorLocal = { x: (-hx * start.width) / 2, y: (-hy * start.height) / 2 };
  const anchorWorld = toWorld(anchorLocal.x, anchorLocal.y, start.rotation);
  const anchor = { x: centerX + anchorWorld.x, y: centerY + anchorWorld.y };

  const delta = toLocal(dx, dy, start.rotation);
  let width = hx !== 0 ? Math.max(minSize, start.width + hx * delta.x) : start.width;
  let height = hy !== 0 ? Math.max(minSize, start.height + hy * delta.y) : start.height;

  if (keepAspect && hx !== 0 && hy !== 0) {
    const scaleX = width / start.width;
    const scaleY = height / start.height;
    const scale = Math.abs(scaleX - 1) > Math.abs(scaleY - 1) ? scaleX : scaleY;
    width = Math.max(minSize, start.width * scale);
    height = Math.max(minSize, start.height * scale);
  }

  const nextAnchor = toWorld((-hx * width) / 2, (-hy * height) / 2, start.rotation);
  const nextCenterX = anchor.x - nextAnchor.x;
  const nextCenterY = anchor.y - nextAnchor.y;
  return {
    x: Math.round(nextCenterX - width / 2),
    y: Math.round(nextCenterY - height / 2),
    width: Math.round(width),
    height: Math.round(height),
  };
}

// Angle (degrees, clockwise, 0 = handle straight up) of the pointer around the layer centre
export function rotationFromPointer(centerX: number, centerY: number, pointerX: number, pointerY: number, snap: boolean): number {
  let degrees = (Math.atan2(pointerX - centerX, -(pointerY - centerY)) * 180) / Math.PI;
  if (snap) degrees = Math.round(degrees / 15) * 15;
  return Math.round(clamp(degrees, -180, 180));
}

export interface SnapResult {
  dx: number;
  dy: number;
  guideX: number | null;
  guideY: number | null;
}

// Snap a moving box to the canvas edges / centre and to the edges / centres of the other layers
export function snapBox(box: Box, others: Box[], canvasWidth: number, canvasHeight: number, threshold: number): SnapResult {
  const xTargets = [0, canvasWidth / 2, canvasWidth];
  const yTargets = [0, canvasHeight / 2, canvasHeight];
  for (const other of others) {
    xTargets.push(other.x, other.x + other.width / 2, other.x + other.width);
    yTargets.push(other.y, other.y + other.height / 2, other.y + other.height);
  }
  const best = (edges: number[], targets: number[]) => {
    let result: { delta: number; guide: number } | null = null;
    for (const edge of edges) {
      for (const target of targets) {
        const delta = target - edge;
        if (Math.abs(delta) <= threshold && (!result || Math.abs(delta) < Math.abs(result.delta))) {
          result = { delta, guide: target };
        }
      }
    }
    return result;
  };
  const snapX = best([box.x, box.x + box.width / 2, box.x + box.width], xTargets);
  const snapY = best([box.y, box.y + box.height / 2, box.y + box.height], yTargets);
  return { dx: snapX?.delta ?? 0, dy: snapY?.delta ?? 0, guideX: snapX?.guide ?? null, guideY: snapY?.guide ?? null };
}
