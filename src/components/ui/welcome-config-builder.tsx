"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { Button } from "@/components/ui/button";
import { ChannelSelect } from "@/components/ui/discord-selects";
import { DiscordMessagePreview } from "@/components/ui/discord-message";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { fetchApi } from "@/lib/api";
import { CopyIcon, PencilIcon, PlusIcon, PlayIcon, SettingsIcon, Trash2Icon, XIcon } from "lucide-react";

export type WelcomeBuilderTab = "messages" | "dynamic" | "simulation";
export type WelcomeMessageMode = "normal" | "embed";

export interface WelcomeMessageGroup {
  id: string;
  name: string;
  channel_id: string;
  enabled: boolean;
}

export interface WelcomeMessageTemplate {
  id: string;
  name: string;
  group_id: string;
  weight: number;
  enabled: boolean;
  message_mode: WelcomeMessageMode;
  content: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_thumbnail: string;
  embed_image: string;
  embed_footer: string;
  dynamic_image_id: string;
}

export type WelcomeDynamicLayerType = "text" | "avatar" | "block" | "logo";

export interface WelcomeDynamicImageLayer {
  id: string;
  name: string;
  type: WelcomeDynamicLayerType;
  enabled: boolean;
  z_position: "back" | "front";
  text: string;
  image_url: string;
  color: string;
  font_weight: "normal" | "bold";
  text_align: "left" | "center" | "right";
  text_vertical_align: "top" | "middle" | "bottom";
  x: number;
  y: number;
  width: number;
  height: number;
  font_size: number;
  opacity: number;
  radius: number;
}

export interface WelcomeDynamicImage {
  id: string;
  name: string;
  width: number;
  height: number;
  layers: WelcomeDynamicImageLayer[];
}

export interface LegacyWelcomeMessage {
  content: string;
  embed_title: string;
  embed_description: string;
  embed_color: string;
  embed_thumbnail: string;
  embed_image: string;
  embed_footer: string;
}

interface WelcomeConfigBuilderProps {
  guildId: string;
  welcomeEnabled: boolean;
  welcomeChannelId: string;
  sendWelcomeOnJoin: boolean;
  sendWelcomeOnVerify: boolean;
  groups: WelcomeMessageGroup[];
  messages: WelcomeMessageTemplate[];
  dynamicImages: WelcomeDynamicImage[];
  onWelcomeEnabledChange: (value: boolean) => void;
  onWelcomeChannelChange: (channelId: string) => void;
  onSendOnJoinChange: (value: boolean) => void;
  onSendOnVerifyChange: (value: boolean) => void;
  onGroupsChange: (groups: WelcomeMessageGroup[]) => void;
  onMessagesChange: (messages: WelcomeMessageTemplate[]) => void;
  onDynamicImagesChange: (images: WelcomeDynamicImage[]) => void;
}

const PREVIEW_TOKENS: Record<string, string> = {
  "${guildname}": "Seisen Hub",
  "${guildmembercount}": "1482",
  "${membercount}": "1482",
  "${username}": "seisen",
  "${userglobalnickname}": "seisen",
  "${usermention}": "@seisen",
  "${userid}": "171442868190314497",
};

const DEFAULT_GROUP_ID = "group-main";

function randomId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function toStringValue(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

function toBooleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function toMessageModeValue(value: unknown, fallback: WelcomeMessageMode): WelcomeMessageMode {
  const normalized = toStringValue(value, fallback).trim().toLowerCase();
  return normalized === "normal" ? "normal" : "embed";
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function ensureArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function createWelcomeGroup(name = "Group 1", channelId = ""): WelcomeMessageGroup {
  return {
    id: randomId("grp"),
    name,
    channel_id: channelId,
    enabled: true,
  };
}

export function createWelcomeMessage(groupId: string, name = "Message 1"): WelcomeMessageTemplate {
  return {
    id: randomId("msg"),
    name,
    group_id: groupId,
    weight: 1,
    enabled: true,
    message_mode: "normal",
    content: "",
    embed_title: "Welcome ${userglobalnickname}!",
    embed_description: "to ${guildname}\n\nYou are member #${guildmembercount}.",
    embed_color: "#5865F2",
    embed_thumbnail: "",
    embed_image: "",
    embed_footer: "Enjoy your stay",
    dynamic_image_id: "",
  };
}

function createWelcomeDynamicLayer(type: WelcomeDynamicLayerType, name: string): WelcomeDynamicImageLayer {
  const base: WelcomeDynamicImageLayer = {
    id: randomId("layer"),
    name,
    type,
    enabled: true,
    z_position: "front",
    text: "",
    image_url: "",
    color: "#FFFFFF",
    font_weight: "normal",
    text_align: "left",
    text_vertical_align: "top",
    x: 24,
    y: 24,
    width: 260,
    height: 80,
    font_size: 22,
    opacity: 100,
    radius: 18,
  };

  if (type === "block") {
    return {
      ...base,
      z_position: "back",
      color: "#1F232B",
      width: 420,
      height: 250,
      radius: 28,
      opacity: 95,
    };
  }

  if (type === "avatar") {
    return {
      ...base,
      width: 96,
      height: 96,
      radius: 999,
      opacity: 100,
    };
  }

  if (type === "logo") {
    return {
      ...base,
      image_url: "",
      width: 96,
      height: 96,
      radius: 18,
      opacity: 100,
    };
  }

  return {
    ...base,
    text: "Welcome ${userglobalnickname}!",
  };
}

export function createWelcomeDynamicImage(name = "Dynamic Image 1"): WelcomeDynamicImage {
  return {
    id: randomId("img"),
    name,
    width: 500,
    height: 350,
    layers: [
      {
        ...createWelcomeDynamicLayer("block", "Card"),
        x: 70,
        y: 52,
      },
      {
        ...createWelcomeDynamicLayer("avatar", "Avatar"),
        x: 206,
        y: 96,
      },
      {
        ...createWelcomeDynamicLayer("text", "Headline"),
        text: "Welcome ${userglobalnickname}!",
        x: 88,
        y: 215,
        font_size: 34,
      },
      {
        ...createWelcomeDynamicLayer("text", "Subline"),
        text: "Member #${guildmembercount} in ${guildname}",
        x: 106,
        y: 266,
        font_size: 20,
        color: "#D8DFEA",
      },
    ],
  };
}

export function applyWelcomeTokens(text: string): string {
  let output = text;
  for (const [token, value] of Object.entries(PREVIEW_TOKENS)) {
    output = output.replaceAll(token, value);
  }
  return output;
}

export function normalizeWelcomeGroups(raw: unknown, fallbackChannelId: string): WelcomeMessageGroup[] {
  const groups: WelcomeMessageGroup[] = [];
  for (const [index, value] of ensureArray(raw).entries()) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    groups.push({
      id: toStringValue(entry.id, `group-${index + 1}`),
      name: toStringValue(entry.name, `Group ${index + 1}`),
      channel_id: toStringValue(entry.channel_id, ""),
      enabled: toBooleanValue(entry.enabled, true),
    });
  }

  if (groups.length === 0) {
    groups.push({
      id: DEFAULT_GROUP_ID,
      name: "Group 1",
      channel_id: fallbackChannelId,
      enabled: true,
    });
  }

  return groups;
}

export function normalizeWelcomeMessages(
  raw: unknown,
  groups: WelcomeMessageGroup[],
  legacy: LegacyWelcomeMessage,
): WelcomeMessageTemplate[] {
  const groupIds = new Set(groups.map((group) => group.id));
  const fallbackGroupId = groups[0]?.id || DEFAULT_GROUP_ID;
  const messages: WelcomeMessageTemplate[] = [];

  for (const [index, value] of ensureArray(raw).entries()) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;
    const rawGroupId = toStringValue(entry.group_id, fallbackGroupId);
    const dynamicImageId = toStringValue(entry.dynamic_image_id, "");

    messages.push({
      id: toStringValue(entry.id, `message-${index + 1}`),
      name: toStringValue(entry.name, `Message ${index + 1}`),
      group_id: groupIds.has(rawGroupId) ? rawGroupId : fallbackGroupId,
      weight: clampNumber(entry.weight, 1, 1, 999),
      enabled: toBooleanValue(entry.enabled, true),
      message_mode: toMessageModeValue(entry.message_mode, dynamicImageId ? "normal" : "embed"),
      content: toStringValue(entry.content, ""),
      embed_title: toStringValue(entry.embed_title, legacy.embed_title),
      embed_description: toStringValue(entry.embed_description, legacy.embed_description),
      embed_color: toStringValue(entry.embed_color, legacy.embed_color),
      embed_thumbnail: toStringValue(entry.embed_thumbnail, ""),
      embed_image: toStringValue(entry.embed_image, ""),
      embed_footer: toStringValue(entry.embed_footer, legacy.embed_footer),
      dynamic_image_id: dynamicImageId,
    });
  }

  if (messages.length === 0) {
    messages.push({
      id: "message-main",
      name: "Message 1",
      group_id: fallbackGroupId,
      weight: 1,
      enabled: true,
      message_mode: "embed",
      content: legacy.content,
      embed_title: legacy.embed_title,
      embed_description: legacy.embed_description,
      embed_color: legacy.embed_color,
      embed_thumbnail: legacy.embed_thumbnail,
      embed_image: legacy.embed_image,
      embed_footer: legacy.embed_footer,
      dynamic_image_id: "",
    });
  }

  return messages;
}

export function normalizeWelcomeDynamicImages(raw: unknown): WelcomeDynamicImage[] {
  const images: WelcomeDynamicImage[] = [];

  for (const [index, value] of ensureArray(raw).entries()) {
    if (!value || typeof value !== "object") continue;
    const entry = value as Record<string, unknown>;

    const layers: WelcomeDynamicImageLayer[] = [];
    for (const [layerIndex, layerValue] of ensureArray(entry.layers).entries()) {
      if (!layerValue || typeof layerValue !== "object") continue;
      const layer = layerValue as Record<string, unknown>;
      const type = toStringValue(layer.type, "text");
      const normalizedType: WelcomeDynamicLayerType =
        type === "avatar" || type === "block" || type === "logo" ? type : "text";
      const zPositionRaw = toStringValue(layer.z_position, normalizedType === "block" ? "back" : "front");
      const zPosition: "back" | "front" = zPositionRaw === "back" ? "back" : "front";
      const fontWeightRaw = toStringValue(layer.font_weight, "normal").toLowerCase();
      const fontWeight: "normal" | "bold" = fontWeightRaw === "bold" ? "bold" : "normal";
      const textAlignRaw = toStringValue(layer.text_align, "left").toLowerCase();
      const textAlign: "left" | "center" | "right" =
        textAlignRaw === "center" || textAlignRaw === "right" ? textAlignRaw : "left";
      const textVerticalAlignRaw = toStringValue(layer.text_vertical_align, "top").toLowerCase();
      const textVerticalAlign: "top" | "middle" | "bottom" =
        textVerticalAlignRaw === "middle" || textVerticalAlignRaw === "bottom" ? textVerticalAlignRaw : "top";

      layers.push({
        id: toStringValue(layer.id, `layer-${layerIndex + 1}`),
        name: toStringValue(layer.name, `Layer ${layerIndex + 1}`),
        type: normalizedType,
        enabled: toBooleanValue(layer.enabled, true),
        z_position: zPosition,
        text: toStringValue(layer.text, ""),
        image_url: toStringValue(layer.image_url, ""),
        color: toStringValue(layer.color, normalizedType === "block" ? "#1F232B" : "#FFFFFF"),
        font_weight: fontWeight,
        text_align: textAlign,
        text_vertical_align: textVerticalAlign,
        x: clampNumber(layer.x, 20, 0, 5000),
        y: clampNumber(layer.y, 20, 0, 5000),
        width: clampNumber(layer.width, 260, 1, 5000),
        height: clampNumber(layer.height, 80, 1, 5000),
        font_size: clampNumber(layer.font_size, 22, 8, 160),
        opacity: clampNumber(layer.opacity, 100, 0, 100),
        radius: clampNumber(layer.radius, 18, 0, 3000),
      });
    }

    images.push({
      id: toStringValue(entry.id, `image-${index + 1}`),
      name: toStringValue(entry.name, `Dynamic Image ${index + 1}`),
      width: clampNumber(entry.width, 500, 128, 4000),
      height: clampNumber(entry.height, 350, 128, 4000),
      layers,
    });
  }

  return images;
}

function weightedPick(messages: WelcomeMessageTemplate[]): WelcomeMessageTemplate | null {
  if (messages.length === 0) return null;

  const weighted = messages.map((message) => ({
    ...message,
    weight: Math.max(1, Number(message.weight) || 1),
  }));

  const totalWeight = weighted.reduce((sum, message) => sum + message.weight, 0);
  let pick = Math.random() * totalWeight;

  for (const message of weighted) {
    pick -= message.weight;
    if (pick <= 0) {
      return message;
    }
  }

  return weighted[weighted.length - 1];
}

function MessageEditModal({
  open,
  onClose,
  message,
  groups,
  dynamicImages,
  onUpdate,
}: {
  open: boolean;
  onClose: () => void;
  message: WelcomeMessageTemplate | null;
  groups: WelcomeMessageGroup[];
  dynamicImages: WelcomeDynamicImage[];
  onUpdate: (nextMessage: WelcomeMessageTemplate) => void;
}) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  if (!open || !message) return null;

  const onFieldChange = <K extends keyof WelcomeMessageTemplate>(key: K, value: WelcomeMessageTemplate[K]) => {
    onUpdate({ ...message, [key]: value });
  };

  const currentDynamicImage = dynamicImages.find((image) => image.id === message.dynamic_image_id) || null;
  const usesAttachmentMode = Boolean(message.dynamic_image_id);
  const usesEmbedMode = !usesAttachmentMode && message.message_mode === "embed";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#334861] bg-[#131f2f] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#28394f] px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-discord-text-muted">Welcome Message Editor</p>
            <h3 className="text-lg font-bold text-white">{message.name}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/30 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b border-[#28394f] bg-[#101a27] px-5">
          {[
            { id: "edit", label: "Edit" },
            { id: "preview", label: "Preview" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as "edit" | "preview")}
                className={`min-w-[150px] border-b-2 px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? "border-discord-blurple bg-[#17283b] text-white"
                    : "border-transparent text-discord-text-muted hover:bg-[#162436] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === "edit" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Name</label>
                  <Input value={message.name} onChange={(event) => onFieldChange("name", event.target.value)} />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Group</label>
                  <select
                    value={message.group_id}
                    onChange={(event) => onFieldChange("group_id", event.target.value)}
                    className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                  >
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Weight</label>
                  <Input
                    type="number"
                    min={1}
                    max={999}
                    value={message.weight}
                    onChange={(event) => onFieldChange("weight", clampNumber(event.target.value, 1, 1, 999))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Message Style</label>
                  <select
                    value={message.message_mode}
                    onChange={(event) => onFieldChange("message_mode", event.target.value === "normal" ? "normal" : "embed")}
                    className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                  >
                    <option value="normal">Normal Message</option>
                    <option value="embed">Embed Message</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-discord-text-muted">
                  <input
                    type="checkbox"
                    checked={message.enabled}
                    onChange={(event) => onFieldChange("enabled", event.target.checked)}
                    className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
                  />
                  Enable message
                </label>
              </div>

              <AdvancedEmbedEditor
                config={{
                  content: message.content,
                  title: message.embed_title,
                  description: message.embed_description,
                  color: message.embed_color,
                  thumbnail_url: message.embed_thumbnail,
                  footer: message.embed_footer,
                }}
                onChange={(key, value) => {
                  if (key === "content") onFieldChange("content", String(value));
                  else if (key === "title") onFieldChange("embed_title", String(value));
                  else if (key === "description") onFieldChange("embed_description", String(value));
                  else if (key === "color") onFieldChange("embed_color", String(value));
                  else if (key === "thumbnail_url") onFieldChange("embed_thumbnail", String(value));
                  else if (key === "footer") onFieldChange("embed_footer", String(value));
                }}
                bottomChildren={
                  <div className="space-y-4 border-t border-[#1E1F22] pt-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Embed Image URL</label>
                        <Input
                          value={message.embed_image}
                          onChange={(event) => onFieldChange("embed_image", event.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Dynamic Image</label>
                        <select
                          value={message.dynamic_image_id}
                          onChange={(event) => onFieldChange("dynamic_image_id", event.target.value)}
                          className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                        >
                          <option value="">None</option>
                          {dynamicImages.map((image) => (
                            <option key={image.id} value={image.id}>
                              {image.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#1E1F22] bg-[#202225]/70 p-3 text-xs text-discord-text-muted">
                      Available tokens: ${"${guildname}"}, ${"${guildmembercount}"}, ${"${username}"}, ${"${userglobalnickname}"}, ${"${usermention}"}, ${"${userid}"}.
                    </div>

                    {usesAttachmentMode && (
                      <div className="rounded-lg border border-[#1f5f2a] bg-[#1f3a25] p-3 text-xs text-green-300">
                        This message has a dynamic image attached. It will be sent as a normal message image attachment (no embed card).
                      </div>
                    )}

                    {!usesAttachmentMode && message.message_mode === "normal" && (
                      <div className="rounded-lg border border-[#24517a] bg-[#183551] p-3 text-xs text-[#b7d9ff]">
                        This message is set to Normal mode. Content is sent as a regular message without an embed card.
                      </div>
                    )}
                  </div>
                }
              >
                <p className="text-sm text-discord-text-muted">This editor controls one welcome message in a randomized group.</p>
              </AdvancedEmbedEditor>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-[#223145] bg-[#0e1824] p-6">
                <DiscordMessagePreview
                  message={{
                    content: applyWelcomeTokens(message.content),
                    embeds: usesEmbedMode
                      ? [
                          {
                            title: applyWelcomeTokens(message.embed_title),
                            description: applyWelcomeTokens(message.embed_description),
                            color:
                              typeof message.embed_color === "string" && message.embed_color.startsWith("#")
                                ? parseInt(message.embed_color.replace("#", ""), 16)
                                : parseInt(message.embed_color || "5814783", 10) || 5814783,
                            thumbnail: message.embed_thumbnail ? { url: applyWelcomeTokens(message.embed_thumbnail) } : undefined,
                            footer: message.embed_footer ? { text: applyWelcomeTokens(message.embed_footer) } : undefined,
                          },
                        ]
                      : [],
                  }}
                  botUser={{
                    username: "Seisen Bot",
                    avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                  }}
                />
              </div>

              {(currentDynamicImage || (!usesEmbedMode && message.embed_image)) && (
                <div className="rounded-xl border border-[#223145] bg-[#0e1824] p-4">
                  <p className="mb-3 text-xs uppercase tracking-[0.12em] text-discord-text-muted">Image Attachment Preview</p>
                  {currentDynamicImage ? (
                    <DynamicImageCanvas image={currentDynamicImage} className="mx-auto max-w-xl" />
                  ) : (
                    <img
                      src={applyWelcomeTokens(message.embed_image)}
                      alt="Attachment"
                      className="max-h-[300px] w-auto rounded-lg border border-white/10"
                    />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DynamicImageCanvas({
  image,
  className,
  editable = false,
  selectedLayerId = null,
  onSelectLayer,
  onLayerMove,
  onClick,
}: {
  image: WelcomeDynamicImage;
  className?: string;
  editable?: boolean;
  selectedLayerId?: string | null;
  onSelectLayer?: (layerId: string) => void;
  onLayerMove?: (layerId: string, nextX: number, nextY: number) => void;
  onClick?: () => void;
}) {
    const frameRef = useRef<HTMLDivElement | null>(null);
    const [frameWidth, setFrameWidth] = useState(image.width);

    useEffect(() => {
      const frame = frameRef.current;
      if (!frame) return;

      const updateWidth = () => {
        const measured = frame.clientWidth;
        if (measured > 0) {
          setFrameWidth(measured);
        }
      };

      updateWidth();

      const observer = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect?.width;
        if (next && next > 0) {
          setFrameWidth(next);
        }
      });

      observer.observe(frame);
      return () => observer.disconnect();
    }, [image.width]);

    const scale = Math.max(0.01, frameWidth / Math.max(1, image.width));
    const scaledHeight = Math.max(1, image.height * scale);

    const sortedLayers = [...image.layers].sort((a, b) => {
      const rank = (layer: WelcomeDynamicImageLayer) => (layer.z_position === "back" ? 0 : 1);
      return rank(a) - rank(b);
    });

    const handleLayerMouseDown = (event: React.MouseEvent, layer: WelcomeDynamicImageLayer) => {
      if (!editable || !onLayerMove) return;

      event.preventDefault();
      event.stopPropagation();
      onSelectLayer?.(layer.id);

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startX = layer.x;
      const startY = layer.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = (moveEvent.clientX - startClientX) / Math.max(scale, 0.01);
        const deltaY = (moveEvent.clientY - startClientY) / Math.max(scale, 0.01);

        const maxX = Math.max(0, image.width - layer.width);
        const maxY = Math.max(0, image.height - layer.height);

        onLayerMove(
          layer.id,
          Math.min(maxX, Math.max(0, startX + deltaX)),
          Math.min(maxY, Math.max(0, startY + deltaY)),
        );
      };

      const handleMouseUp = () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    };

    return (
      <div
        ref={frameRef}
        className={`relative w-full overflow-hidden rounded-xl border border-white/15 bg-[#0e1824] ${onClick ? "cursor-pointer" : ""} ${className || ""}`}
        style={{ height: `${scaledHeight}px` }}
        onClick={onClick}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: `${image.width}px`,
            height: `${image.height}px`,
            transform: `scale(${scale})`,
          }}
        >
          {sortedLayers.map((layer) => {
            if (!layer.enabled) return null;

            const isSelected = editable && selectedLayerId === layer.id;
            const style: CSSProperties = {
              position: "absolute",
              left: `${layer.x}px`,
              top: `${layer.y}px`,
              width: `${layer.width}px`,
              height: `${layer.height}px`,
              opacity: Math.max(0, Math.min(100, layer.opacity)) / 100,
              borderRadius: `${layer.radius}px`,
              userSelect: "none",
              cursor: editable ? "grab" : "default",
              outline: isSelected ? "2px solid rgba(45, 196, 183, 0.9)" : undefined,
              outlineOffset: isSelected ? "1px" : undefined,
            };

            const interactiveProps = editable
              ? {
                  onMouseDown: (event: React.MouseEvent) => handleLayerMouseDown(event, layer),
                  onClick: (event: React.MouseEvent) => {
                    event.stopPropagation();
                    onSelectLayer?.(layer.id);
                  },
                  title: "Drag to move",
                }
              : {
                  onClick: (event: React.MouseEvent) => event.stopPropagation(),
                };

            if (layer.type === "block") {
              return <div key={layer.id} style={{ ...style, background: layer.color || "#1F232B" }} {...interactiveProps} />;
            }

            if (layer.type === "avatar") {
              return (
                <div
                  key={layer.id}
                  style={{
                    ...style,
                    borderRadius: "999px",
                    border: "3px solid #0a111b",
                    background: "linear-gradient(135deg, #6d7cff, #4e61f6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 700,
                    fontSize: `${Math.max(10, layer.width * 0.32)}px`,
                  }}
                  {...interactiveProps}
                >
                  U
                </div>
              );
            }

            if (layer.type === "logo") {
              const logoUrl = applyWelcomeTokens(layer.image_url || "");
              return (
                <div
                  key={layer.id}
                  style={{
                    ...style,
                    overflow: "hidden",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(11,20,32,0.72)",
                  }}
                  {...interactiveProps}
                >
                  {logoUrl.startsWith("http") ? (
                    <img
                      src={logoUrl}
                      alt={layer.name || "Logo"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-wide text-discord-text-muted">
                      Logo
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={layer.id}
                style={{
                  ...style,
                  color: layer.color || "#FFFFFF",
                  fontSize: `${Math.max(8, layer.font_size)}px`,
                  lineHeight: 1.15,
                  fontWeight: layer.font_weight === "bold" ? 800 : 500,
                  textAlign: layer.text_align || "left",
                  display: "flex",
                  justifyContent:
                    layer.text_align === "center"
                      ? "center"
                      : layer.text_align === "right"
                      ? "flex-end"
                      : "flex-start",
                  alignItems:
                    layer.text_vertical_align === "middle"
                      ? "center"
                      : layer.text_vertical_align === "bottom"
                      ? "flex-end"
                      : "flex-start",
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                  boxSizing: "border-box",
                  padding: "2px 4px",
                }}
                {...interactiveProps}
              >
                {applyWelcomeTokens(layer.text || "")}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

function DynamicImageEditorModal({
    open,
    onClose,
    image,
    onUpdate,
  }: {
    open: boolean;
    onClose: () => void;
    image: WelcomeDynamicImage | null;
    onUpdate: (nextImage: WelcomeDynamicImage) => void;
  }) {
    const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

    useEffect(() => {
      if (!open || !image) return;
      setSelectedLayerId((current) => {
        if (current && image.layers.some((layer) => layer.id === current)) {
          return current;
        }
        return image.layers[0]?.id || null;
      });
    }, [open, image]);

    if (!open || !image) return null;

  const selectedLayer = image.layers.find((layer) => layer.id === selectedLayerId) || image.layers[0] || null;

  const updateLayer = (layerId: string, patch: Partial<WelcomeDynamicImageLayer>) => {
    onUpdate({
      ...image,
      layers: image.layers.map((layer) => (layer.id === layerId ? { ...layer, ...patch } : layer)),
    });
  };

  const moveLayer = (layerId: string, nextX: number, nextY: number) => {
    const targetLayer = image.layers.find((layer) => layer.id === layerId);
    if (!targetLayer) return;

    const maxX = Math.max(0, image.width - targetLayer.width);
    const maxY = Math.max(0, image.height - targetLayer.height);

    updateLayer(layerId, {
      x: clampNumber(nextX, targetLayer.x, 0, maxX),
      y: clampNumber(nextY, targetLayer.y, 0, maxY),
    });
  };

  const addLayer = (type: WelcomeDynamicLayerType) => {
    const layerName =
      type === "text" ? "Text" :
      type === "avatar" ? "Avatar" :
      type === "logo" ? "Logo" :
      "Block";
    const nextLayer = createWelcomeDynamicLayer(type, `${layerName} ${image.layers.length + 1}`);
    onUpdate({ ...image, layers: [...image.layers, nextLayer] });
    setSelectedLayerId(nextLayer.id);
  };

  const removeLayer = (layerId: string) => {
    const nextLayers = image.layers.filter((layer) => layer.id !== layerId);
    onUpdate({ ...image, layers: nextLayers });
    if (selectedLayerId === layerId) {
      setSelectedLayerId(nextLayers[0]?.id || null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="flex h-[92vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-[#334861] bg-[#131f2f] shadow-2xl">
        <div className="flex w-[320px] flex-col border-r border-[#2a3b52] bg-[#101b2a]">
          <div className="border-b border-[#2a3b52] px-4 py-4">
            <p className="text-xs uppercase tracking-[0.12em] text-discord-text-muted">Dynamic Image</p>
            <h3 className="text-lg font-bold text-white">{image.name}</h3>
          </div>

          <div className="space-y-3 border-b border-[#2a3b52] px-4 py-4">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Image Name</label>
              <Input value={image.name} onChange={(event) => onUpdate({ ...image, name: event.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Width</label>
                <Input
                  type="number"
                  min={128}
                  max={4000}
                  value={image.width}
                  onChange={(event) => onUpdate({ ...image, width: clampNumber(event.target.value, 500, 128, 4000) })}
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Height</label>
                <Input
                  type="number"
                  min={128}
                  max={4000}
                  value={image.height}
                  onChange={(event) => onUpdate({ ...image, height: clampNumber(event.target.value, 350, 128, 4000) })}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Layers</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => addLayer("text")}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-discord-text-muted transition hover:border-white/35 hover:text-white"
              >
                + Text
              </button>
              <button
                type="button"
                onClick={() => addLayer("avatar")}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-discord-text-muted transition hover:border-white/35 hover:text-white"
              >
                + Avatar
              </button>
              <button
                type="button"
                onClick={() => addLayer("logo")}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-discord-text-muted transition hover:border-white/35 hover:text-white"
              >
                + Logo
              </button>
              <button
                type="button"
                onClick={() => addLayer("block")}
                className="rounded-lg border border-white/15 px-2 py-1 text-xs text-discord-text-muted transition hover:border-white/35 hover:text-white"
              >
                + Block
              </button>
            </div>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto px-4 pb-4">
            {image.layers.map((layer) => {
              const selected = selectedLayer?.id === layer.id;
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedLayerId(layer.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left ${
                    selected
                      ? "border-discord-blurple bg-[#16304b]"
                      : "border-[#26384d] bg-[#152334] hover:border-[#375170]"
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold text-white">{layer.name}</div>
                    <div className="text-xs text-discord-text-muted">{layer.type} · {layer.z_position}</div>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    className="rounded p-1 text-discord-text-muted transition hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#2a3b52] px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-discord-text-muted">Live Canvas</p>
              <h4 className="text-lg font-bold text-white">Dynamic Image Designer</h4>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/30 hover:text-white"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="rounded-xl border border-[#263a50] bg-[#0e1824] p-4">
              <DynamicImageCanvas
                image={image}
                className="mx-auto max-w-[820px]"
                editable
                selectedLayerId={selectedLayer?.id || null}
                onSelectLayer={setSelectedLayerId}
                onLayerMove={moveLayer}
              />
              <p className="mt-3 text-xs text-discord-text-muted">Tip: Click a layer and drag it directly on the canvas to reposition.</p>
            </div>

            <div className="rounded-xl border border-[#263a50] bg-[#111c2b] p-4">
              {!selectedLayer && <p className="text-sm text-discord-text-muted">Select a layer to edit its properties.</p>}

              {selectedLayer && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Layer Name</label>
                    <Input
                      value={selectedLayer.name}
                      onChange={(event) => updateLayer(selectedLayer.id, { name: event.target.value })}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-discord-text-muted">
                    <input
                      type="checkbox"
                      checked={selectedLayer.enabled}
                      onChange={(event) => updateLayer(selectedLayer.id, { enabled: event.target.checked })}
                      className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
                    />
                    Layer enabled
                  </label>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Layer Position</label>
                    <select
                      value={selectedLayer.z_position}
                      onChange={(event) => updateLayer(selectedLayer.id, { z_position: event.target.value === "back" ? "back" : "front" })}
                      className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                    >
                      <option value="back">Back</option>
                      <option value="front">Front</option>
                    </select>
                  </div>

                  {selectedLayer.type === "text" && (
                    <>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Text</label>
                        <Textarea
                          className="h-24"
                          value={selectedLayer.text}
                          onChange={(event) => updateLayer(selectedLayer.id, { text: event.target.value })}
                        />
                      </div>

                      <label className="flex items-center gap-2 text-sm text-discord-text-muted">
                        <input
                          type="checkbox"
                          checked={selectedLayer.font_weight === "bold"}
                          onChange={(event) =>
                            updateLayer(selectedLayer.id, { font_weight: event.target.checked ? "bold" : "normal" })
                          }
                          className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
                        />
                        Bold text
                      </label>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Text Align</label>
                          <select
                            value={selectedLayer.text_align}
                            onChange={(event) =>
                              updateLayer(selectedLayer.id, {
                                text_align:
                                  event.target.value === "center" || event.target.value === "right"
                                    ? event.target.value
                                    : "left",
                              })
                            }
                            className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                        <div>
                          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Text Position</label>
                          <select
                            value={selectedLayer.text_vertical_align}
                            onChange={(event) =>
                              updateLayer(selectedLayer.id, {
                                text_vertical_align:
                                  event.target.value === "middle" || event.target.value === "bottom"
                                    ? event.target.value
                                    : "top",
                              })
                            }
                            className="flex h-10 w-full rounded-xl border border-white/14 bg-[#0c1825]/92 px-3 py-2 text-sm text-discord-text"
                          >
                            <option value="top">Top</option>
                            <option value="middle">Middle</option>
                            <option value="bottom">Bottom</option>
                          </select>
                        </div>
                      </div>
                    </>
                  )}

                  {selectedLayer.type === "logo" && (
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Logo Image URL</label>
                      <Input
                        value={selectedLayer.image_url}
                        onChange={(event) => updateLayer(selectedLayer.id, { image_url: event.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">X</label>
                      <Input
                        type="number"
                        value={selectedLayer.x}
                        onChange={(event) => updateLayer(selectedLayer.id, { x: clampNumber(event.target.value, 0, 0, 5000) })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Y</label>
                      <Input
                        type="number"
                        value={selectedLayer.y}
                        onChange={(event) => updateLayer(selectedLayer.id, { y: clampNumber(event.target.value, 0, 0, 5000) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Width</label>
                      <Input
                        type="number"
                        value={selectedLayer.width}
                        onChange={(event) => updateLayer(selectedLayer.id, { width: clampNumber(event.target.value, 1, 1, 5000) })}
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Height</label>
                      <Input
                        type="number"
                        value={selectedLayer.height}
                        onChange={(event) => updateLayer(selectedLayer.id, { height: clampNumber(event.target.value, 1, 1, 5000) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Color</label>
                      <Input
                        value={selectedLayer.color}
                        onChange={(event) => updateLayer(selectedLayer.id, { color: event.target.value })}
                        placeholder="#FFFFFF"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Opacity %</label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={selectedLayer.opacity}
                        onChange={(event) => updateLayer(selectedLayer.id, { opacity: clampNumber(event.target.value, 100, 0, 100) })}
                      />
                    </div>
                  </div>

                  {selectedLayer.type !== "avatar" && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Font Size</label>
                        <Input
                          type="number"
                          min={8}
                          max={160}
                          value={selectedLayer.font_size}
                          onChange={(event) => updateLayer(selectedLayer.id, { font_size: clampNumber(event.target.value, 22, 8, 160) })}
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Radius</label>
                        <Input
                          type="number"
                          min={0}
                          max={3000}
                          value={selectedLayer.radius}
                          onChange={(event) => updateLayer(selectedLayer.id, { radius: clampNumber(event.target.value, 0, 0, 3000) })}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SimulationModal({
  open,
  onClose,
  groups,
  selectedGroupIds,
  onSelectedGroupIdsChange,
  onSimulate,
}: {
  open: boolean;
  onClose: () => void;
  groups: WelcomeMessageGroup[];
  selectedGroupIds: string[];
  onSelectedGroupIdsChange: (groupIds: string[]) => void;
  onSimulate: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-[#334861] bg-[#162334] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2a3b52] px-6 py-4">
          <h3 className="text-2xl font-bold text-white">Simulate Join</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/30 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-6 py-5">
          <p className="text-sm text-discord-text-muted">Select which randomized groups should be included in this simulation.</p>
          <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-lg border border-[#2d4259] bg-[#111c2a] p-3">
            {groups.map((group) => {
              const checked = selectedGroupIds.includes(group.id);
              return (
                <label key={group.id} className="flex items-center justify-between rounded-md border border-[#293b52] bg-[#1a2b3f] px-3 py-2 text-sm text-discord-text">
                  <span>{group.name}</span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      if (event.target.checked) {
                        onSelectedGroupIdsChange([...selectedGroupIds, group.id]);
                      } else {
                        onSelectedGroupIdsChange(selectedGroupIds.filter((id) => id !== group.id));
                      }
                    }}
                    className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
                  />
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end border-t border-[#2a3b52] px-6 py-4">
          <Button
            onClick={() => {
              onSimulate();
              onClose();
            }}
            className="bg-[#2081de] text-white hover:bg-[#1a71c4]"
          >
            Simulate all
          </Button>
        </div>
      </div>
    </div>
  );
}

function AttachDynamicImageModal({
  open,
  image,
  messages,
  groups,
  onClose,
  onAttach,
}: {
  open: boolean;
  image: WelcomeDynamicImage | null;
  messages: WelcomeMessageTemplate[];
  groups: WelcomeMessageGroup[];
  onClose: () => void;
  onAttach: (messageId: string) => void;
}) {
  if (!open || !image) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl border border-[#334861] bg-[#1a2738] shadow-2xl">
        <div className="flex items-center justify-end px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/30 hover:text-white"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6">
          <div className="mb-6 rounded-xl border border-[#2b425a] bg-[#122133] p-3">
            <DynamicImageCanvas image={image} className="mx-auto max-w-[220px]" />
          </div>

          <h3 className="mb-3 text-4xl font-bold tracking-tight text-white">Select a message</h3>

          <div className="space-y-2">
            {messages.map((message, index) => {
              const groupName = groups.find((group) => group.id === message.group_id)?.name || "Group";
              return (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => {
                    onAttach(message.id);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-lg border border-[#1f5f2a] bg-[#25722f] px-4 py-3 text-left text-white transition hover:bg-[#2c8738]"
                >
                  <div>
                    <p className="text-2xl font-semibold">{message.name || `Message ${index + 1}`}</p>
                    <p className="text-xs text-white/75">{groupName}</p>
                  </div>
                  <span className="text-2xl leading-none">›</span>
                </button>
              );
            })}

            {messages.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#3a5168] bg-[#142335] p-5 text-center text-sm text-discord-text-muted">
                Create a message first, then attach this dynamic image.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function WelcomeConfigBuilder({
  guildId,
  welcomeEnabled,
  welcomeChannelId,
  sendWelcomeOnJoin,
  sendWelcomeOnVerify,
  groups,
  messages,
  dynamicImages,
  onWelcomeEnabledChange,
  onWelcomeChannelChange,
  onSendOnJoinChange,
  onSendOnVerifyChange,
  onGroupsChange,
  onMessagesChange,
  onDynamicImagesChange,
}: WelcomeConfigBuilderProps) {
  const { toast } = useToast();
  const [tab, setTab] = useState<WelcomeBuilderTab>("messages");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingImageId, setEditingImageId] = useState<string | null>(null);
  const [attachImageId, setAttachImageId] = useState<string | null>(null);
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [simulationSelectedGroupIds, setSimulationSelectedGroupIds] = useState<string[]>(groups.map((group) => group.id));
  const [simulationResults, setSimulationResults] = useState<WelcomeMessageTemplate[]>([]);
  const [simulationSending, setSimulationSending] = useState(false);

  const groupedMessages = useMemo(() => {
    const map = new Map<string, WelcomeMessageTemplate[]>();
    for (const group of groups) {
      map.set(group.id, messages.filter((message) => message.group_id === group.id));
    }
    return map;
  }, [groups, messages]);

  const editingMessage = messages.find((message) => message.id === editingMessageId) || null;
  const editingImage = dynamicImages.find((image) => image.id === editingImageId) || null;
  const attachImage = dynamicImages.find((image) => image.id === attachImageId) || null;

  const patchMessage = (messageId: string, patch: Partial<WelcomeMessageTemplate>) => {
    onMessagesChange(messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)));
  };

  const replaceMessage = (nextMessage: WelcomeMessageTemplate) => {
    onMessagesChange(messages.map((message) => (message.id === nextMessage.id ? nextMessage : message)));
  };

  const replaceDynamicImage = (nextImage: WelcomeDynamicImage) => {
    onDynamicImagesChange(dynamicImages.map((image) => (image.id === nextImage.id ? nextImage : image)));
  };

  const addGroup = () => {
    const nextGroup = createWelcomeGroup(`Group ${groups.length + 1}`, welcomeChannelId);
    onGroupsChange([...groups, nextGroup]);

    if (!messages.some((message) => message.group_id === nextGroup.id)) {
      onMessagesChange([...messages, createWelcomeMessage(nextGroup.id, `Message ${messages.length + 1}`)]);
    }
  };

  const removeGroup = (groupId: string) => {
    if (groups.length <= 1) return;
    const nextGroups = groups.filter((group) => group.id !== groupId);
    const fallbackGroupId = nextGroups[0]?.id || DEFAULT_GROUP_ID;

    onGroupsChange(nextGroups);
    onMessagesChange(
      messages
        .filter((message) => message.group_id !== groupId)
        .map((message) =>
          nextGroups.some((group) => group.id === message.group_id)
            ? message
            : { ...message, group_id: fallbackGroupId }
        )
    );

    setSimulationSelectedGroupIds((prev) => prev.filter((id) => id !== groupId));
  };

  const addMessageToGroup = (groupId: string) => {
    const nextName = `Message ${messages.length + 1}`;
    const nextMessage = createWelcomeMessage(groupId, nextName);
    onMessagesChange([...messages, nextMessage]);
    setEditingMessageId(nextMessage.id);
  };

  const duplicateMessage = (message: WelcomeMessageTemplate) => {
    const clone: WelcomeMessageTemplate = {
      ...message,
      id: randomId("msg"),
      name: `${message.name} Copy`,
    };
    onMessagesChange([...messages, clone]);
    setEditingMessageId(clone.id);
  };

  const deleteMessage = (messageId: string) => {
    const nextMessages = messages.filter((message) => message.id !== messageId);
    onMessagesChange(nextMessages.length > 0 ? nextMessages : [createWelcomeMessage(groups[0]?.id || DEFAULT_GROUP_ID)]);
    if (editingMessageId === messageId) {
      setEditingMessageId(null);
    }
  };

  const addDynamicImage = () => {
    const nextImage = createWelcomeDynamicImage(`Dynamic Image ${dynamicImages.length + 1}`);
    onDynamicImagesChange([...dynamicImages, nextImage]);
    setEditingImageId(nextImage.id);
  };

  const deleteDynamicImage = (imageId: string) => {
    onDynamicImagesChange(dynamicImages.filter((image) => image.id !== imageId));
    onMessagesChange(
      messages.map((message) =>
        message.dynamic_image_id === imageId
          ? { ...message, dynamic_image_id: "" }
          : message
      )
    );
    if (editingImageId === imageId) {
      setEditingImageId(null);
    }
    if (attachImageId === imageId) {
      setAttachImageId(null);
    }
  };

  const attachDynamicImageToMessage = (imageId: string, messageId: string) => {
    onMessagesChange(
      messages.map((message) =>
        message.id === messageId
          ? { ...message, dynamic_image_id: imageId }
          : message
      )
    );
  };

  const getSimulationTargetGroupIds = () => {
    return simulationSelectedGroupIds.length > 0
      ? simulationSelectedGroupIds
      : groups.filter((group) => group.enabled).map((group) => group.id);
  };

  const pickSimulationMessages = (targetGroupIds: string[]) => {
    const pickedByGroup = new Map<string, WelcomeMessageTemplate>();
    for (const groupId of targetGroupIds) {
      const candidates = messages.filter((message) => message.group_id === groupId && message.enabled);
      const choice = weightedPick(candidates);
      if (choice && !pickedByGroup.has(groupId)) {
        pickedByGroup.set(groupId, choice);
      }
    }
    return Array.from(pickedByGroup.values());
  };

  const runSimulation = () => {
    const picked = pickSimulationMessages(getSimulationTargetGroupIds());
    setSimulationResults(picked);
    return picked;
  };

  const sendSimulationToChannels = async (forcedPicks?: WelcomeMessageTemplate[]) => {
    const targetGroupIds = getSimulationTargetGroupIds();
    const pickedByGroup = new Map<string, WelcomeMessageTemplate>();

    for (const message of forcedPicks || []) {
      if (!targetGroupIds.includes(message.group_id) || !message.enabled) continue;
      if (!pickedByGroup.has(message.group_id)) {
        pickedByGroup.set(message.group_id, message);
      }
    }

    if (pickedByGroup.size === 0) {
      for (const message of simulationResults) {
        if (!targetGroupIds.includes(message.group_id) || !message.enabled) continue;
        if (!pickedByGroup.has(message.group_id)) {
          pickedByGroup.set(message.group_id, message);
        }
      }
    }

    if (pickedByGroup.size === 0) {
      const generatedPicks = pickSimulationMessages(targetGroupIds);
      for (const message of generatedPicks) {
        if (!pickedByGroup.has(message.group_id)) {
          pickedByGroup.set(message.group_id, message);
        }
      }
      setSimulationResults(generatedPicks);
    }

    const messageIds = Array.from(pickedByGroup.values()).map((message) => message.id).filter(Boolean);

    if (messageIds.length === 0) {
      toast("No enabled messages found for the selected groups.", "error");
      return;
    }

    setSimulationSending(true);
    try {
      const result = await fetchApi("/trigger/simulate_welcome", undefined, {
        method: "POST",
        body: JSON.stringify({
          guild_id: guildId,
          payload: {
            group_ids: targetGroupIds,
            message_ids: messageIds,
          },
        }),
      });

      const sentCount = Number(result?.sent_count ?? 0);
      if (sentCount > 0) {
        toast(`Welcome simulation sent ${sentCount} message(s).`, "success");
      } else {
        toast("Simulation sent 0 messages. Check group/default welcome channel and enabled messages.", "error");
      }
    } catch (error: any) {
      toast(`Failed to send simulation: ${error?.message || "Unknown error"}`, "error");
    } finally {
      setSimulationSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[#1E1F22] bg-[#2B2D31] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Welcome Messages</h2>
          <p className="text-sm text-discord-text-muted">Build randomized join messages, dynamic images, and simulation exactly from one place.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setSimulationOpen(true)} className="bg-[#1c6fbd] text-white hover:bg-[#1a62a5]">
            <PlayIcon className="mr-1 h-4 w-4" />
            Simulate Join
          </Button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-[#233246] bg-[#1a2738] p-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="flex items-center gap-2 text-sm text-discord-text-muted">
          <input
            type="checkbox"
            checked={welcomeEnabled}
            onChange={(event) => onWelcomeEnabledChange(event.target.checked)}
            className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
          />
          Enable welcome messages
        </label>

        <label className="flex items-center gap-2 text-sm text-discord-text-muted">
          <input
            type="checkbox"
            checked={sendWelcomeOnJoin}
            onChange={(event) => onSendOnJoinChange(event.target.checked)}
            className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
          />
          Send on join
        </label>

        <label className="flex items-center gap-2 text-sm text-discord-text-muted">
          <input
            type="checkbox"
            checked={sendWelcomeOnVerify}
            onChange={(event) => onSendOnVerifyChange(event.target.checked)}
            className="h-4 w-4 rounded border-[#1E1F22] bg-discord-darkest text-discord-blurple"
          />
          Send after verify
        </label>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-discord-text-muted">Default Welcome Channel</label>
          <ChannelSelect
            guildId={guildId}
            value={welcomeChannelId}
            onChange={onWelcomeChannelChange}
            placeholder="Select default channel..."
          />
        </div>
      </div>

      <div className="mb-4 flex overflow-hidden rounded-xl border border-[#24374d] bg-[#101b29]">
        {[
          { id: "messages", label: "Messages" },
          { id: "dynamic", label: "Dynamic images" },
          { id: "simulation", label: "Simulation" },
        ].map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id as WelcomeBuilderTab)}
              className={`flex-1 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                active
                  ? "border-discord-blurple bg-[#1a2d44] text-white"
                  : "border-transparent text-discord-text-muted hover:bg-[#17283d] hover:text-white"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "messages" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-discord-text-muted">Each group sends one weighted-random message when onboarding welcome runs.</p>
            <Button onClick={addGroup} className="bg-[#162b40] hover:bg-[#1b334d]">
              <PlusIcon className="mr-1 h-4 w-4" />
              New group
            </Button>
          </div>

          {groups.map((group, groupIndex) => {
            const groupMessages = groupedMessages.get(group.id) || [];
            const totalWeight = groupMessages.reduce((sum, item) => sum + Math.max(1, Number(item.weight) || 1), 0);

            return (
              <div key={group.id} className="rounded-xl border border-[#253951] bg-[#142336] p-4">
                <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                  <Input
                    value={group.name}
                    onChange={(event) =>
                      onGroupsChange(
                        groups.map((item) => (item.id === group.id ? { ...item, name: event.target.value } : item))
                      )
                    }
                    placeholder={`Group ${groupIndex + 1}`}
                  />
                  <ChannelSelect
                    guildId={guildId}
                    value={group.channel_id}
                    onChange={(channelId) =>
                      onGroupsChange(
                        groups.map((item) => (item.id === group.id ? { ...item, channel_id: channelId } : item))
                      )
                    }
                    placeholder="Group channel (optional)"
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={() => addMessageToGroup(group.id)} className="h-10 bg-[#1d3651] hover:bg-[#254264]">
                      <PlusIcon className="mr-1 h-4 w-4" />
                      New message
                    </Button>
                    <button
                      type="button"
                      onClick={() => removeGroup(group.id)}
                      disabled={groups.length <= 1}
                      className="rounded-lg border border-red-500/40 bg-red-500/15 p-2 text-red-200 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {groupMessages.map((message) => {
                    const probability = totalWeight > 0 ? ((Math.max(1, Number(message.weight) || 1) / totalWeight) * 100).toFixed(1) : "0.0";
                    const dynamic = dynamicImages.find((image) => image.id === message.dynamic_image_id);
                    const modeLabel = message.dynamic_image_id ? "Normal (dynamic)" : message.message_mode === "embed" ? "Embed" : "Normal";
                    return (
                      <div key={message.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2f465f] bg-[#1a2b3f] px-3 py-2">
                        <div>
                          <p className="font-semibold text-white">{message.name}</p>
                          <p className="text-xs text-discord-text-muted">
                            Send probability: {probability}% - Mode: {modeLabel}{dynamic ? ` - Dynamic: ${dynamic.name}` : ""}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 rounded-lg border border-[#304862] bg-[#111c2b] px-2 py-1">
                            <Input
                              type="number"
                              min={1}
                              max={999}
                              value={message.weight}
                              onChange={(event) => patchMessage(message.id, { weight: clampNumber(event.target.value, 1, 1, 999) })}
                              className="h-8 w-[64px]"
                            />
                            <span className="text-sm text-discord-text-muted">x</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingMessageId(message.id)}
                            className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/35 hover:text-white"
                          >
                            <PencilIcon className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => duplicateMessage(message)}
                            className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/35 hover:text-white"
                          >
                            <CopyIcon className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteMessage(message.id)}
                            className="rounded-lg border border-red-500/40 bg-red-500/15 p-2 text-red-200 transition hover:bg-red-500/25"
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {groupMessages.length === 0 && (
                    <button
                      type="button"
                      onClick={() => addMessageToGroup(group.id)}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#3a5168] bg-[#142335] text-discord-text-muted transition hover:border-[#4f6b88] hover:text-white"
                    >
                      <PlusIcon className="h-4 w-4" />
                      New message
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "dynamic" && (
        <div className="space-y-4">
          <p className="text-sm text-discord-text-muted">
            Dynamic images are attached per message. Layers support text tokens, member avatar blocks, and styled backgrounds.
          </p>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {dynamicImages.map((image) => (
              <div key={image.id} className="rounded-xl border border-[#2b425a] bg-[#142336] p-3">
                <DynamicImageCanvas image={image} className="mb-3" onClick={() => setEditingImageId(image.id)} />
                <p className="mb-2 text-xs text-discord-text-muted">Click image to open designer</p>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{image.name}</p>
                    <p className="text-xs text-discord-text-muted">{image.width} x {image.height}px - {image.layers.length} layers</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingImageId(image.id)}
                      className="rounded-lg border border-white/15 p-2 text-discord-text-muted transition hover:border-white/35 hover:text-white"
                    >
                      <SettingsIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDynamicImage(image.id)}
                      className="rounded-lg border border-red-500/40 bg-red-500/15 p-2 text-red-200 transition hover:bg-red-500/25"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAttachImageId(image.id)}
                  className="mt-3 flex w-full items-center justify-between rounded-lg bg-[#1983e8] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#1676cf]"
                >
                  <span>Attach to message</span>
                  <span className="text-2xl leading-none">›</span>
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={addDynamicImage}
              className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-[#3b5268] bg-[#122133] text-discord-text-muted transition hover:border-[#557898] hover:text-white"
            >
              <PlusIcon className="mb-2 h-6 w-6" />
              <span className="text-xl font-semibold">New dynamic image</span>
            </button>
          </div>
        </div>
      )}

      {tab === "simulation" && (
        <div className="space-y-4">
          <p className="text-sm text-discord-text-muted">Run local simulations to preview which messages are selected from each randomized group.</p>
          <div className="flex items-center gap-2">
            <Button onClick={() => setSimulationOpen(true)} className="bg-[#1c6fbd] text-white hover:bg-[#1a62a5]">
              <PlayIcon className="mr-1 h-4 w-4" />
              Open simulation picker
            </Button>
            <Button onClick={runSimulation} className="bg-[#16304a] hover:bg-[#1d3e5e]">
              Simulate with current groups
            </Button>
            <Button
              onClick={() => {
                void sendSimulationToChannels();
              }}
              disabled={simulationSending}
              className="bg-[#1d6f44] text-white hover:bg-[#1b613d] disabled:opacity-60"
            >
              {simulationSending ? "Sending..." : "Send simulation to channels"}
            </Button>
          </div>

          <div className="space-y-4">
            {simulationResults.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#3b536a] bg-[#111c2b] p-8 text-center text-discord-text-muted">
                No simulation has run yet.
              </div>
            )}

            {simulationResults.map((message) => {
              const group = groups.find((item) => item.id === message.group_id);
              const dynamic = dynamicImages.find((image) => image.id === message.dynamic_image_id) || null;
              const usesAttachmentMode = Boolean(message.dynamic_image_id);
              const usesEmbedMode = !usesAttachmentMode && message.message_mode === "embed";

              return (
                <div key={message.id} className="rounded-xl border border-[#2a3f57] bg-[#111c2b] p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{message.name}</p>
                      <p className="text-xs text-discord-text-muted">Picked from {group?.name || "Unknown group"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-[#223145] bg-[#0f1a27] p-5">
                    <DiscordMessagePreview
                      message={{
                        content: applyWelcomeTokens(message.content),
                        embeds: usesEmbedMode
                          ? [
                              {
                                title: applyWelcomeTokens(message.embed_title),
                                description: applyWelcomeTokens(message.embed_description),
                                color:
                                  typeof message.embed_color === "string" && message.embed_color.startsWith("#")
                                    ? parseInt(message.embed_color.replace("#", ""), 16)
                                    : parseInt(message.embed_color || "5814783", 10) || 5814783,
                                thumbnail: message.embed_thumbnail
                                  ? { url: applyWelcomeTokens(message.embed_thumbnail) }
                                  : undefined,
                                footer: message.embed_footer ? { text: applyWelcomeTokens(message.embed_footer) } : undefined,
                              },
                            ]
                          : [],
                      }}
                      botUser={{
                        username: "Seisen Bot",
                        avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
                      }}
                    />
                  </div>

                  {dynamic && (
                    <div className="mt-3 rounded-xl border border-[#253a50] bg-[#0e1824] p-3">
                      <p className="mb-2 text-xs uppercase tracking-[0.12em] text-discord-text-muted">Attached Dynamic Image</p>
                      <DynamicImageCanvas image={dynamic} className="max-w-xl" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-lg border border-[#1E1F22] bg-[#202225]/70 p-3 text-xs text-discord-text-muted">
        Template variables supported in welcome content, embeds, and dynamic text layers: ${"${guildname}"}, ${"${guildmembercount}"}, ${"${username}"}, ${"${userglobalnickname}"}, ${"${usermention}"}, ${"${userid}"}.
      </div>

      <MessageEditModal
        open={Boolean(editingMessage)}
        onClose={() => setEditingMessageId(null)}
        message={editingMessage}
        groups={groups}
        dynamicImages={dynamicImages}
        onUpdate={replaceMessage}
      />

      <DynamicImageEditorModal
        open={Boolean(editingImage)}
        onClose={() => setEditingImageId(null)}
        image={editingImage}
        onUpdate={replaceDynamicImage}
      />

      <SimulationModal
        open={simulationOpen}
        onClose={() => setSimulationOpen(false)}
        groups={groups}
        selectedGroupIds={simulationSelectedGroupIds}
        onSelectedGroupIdsChange={setSimulationSelectedGroupIds}
        onSimulate={() => {
          const picked = runSimulation();
          void sendSimulationToChannels(picked);
        }}
      />

      <AttachDynamicImageModal
        open={Boolean(attachImage)}
        image={attachImage}
        messages={messages}
        groups={groups}
        onClose={() => setAttachImageId(null)}
        onAttach={(messageId) => attachDynamicImageToMessage(attachImage?.id || "", messageId)}
      />
    </div>
  );
}
