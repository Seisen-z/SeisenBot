"use client";

import { useEffect, useRef, useState, use } from "react";
import { Button } from "@/components/ui/button";
import { fetchApi } from "@/lib/api";
import { useToast } from "@/components/ui/toast";
import { ChannelSelect, RoleSelect } from "@/components/ui/discord-selects";
import { Input } from "@/components/ui/input";
import { AdvancedEmbedEditor } from "@/components/ui/embed-editor";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Heart } from "lucide-react";

interface DonationSettings {
  enabled: boolean;
  channel_id: string;
  message_id?: string;
  announce_channel_id: string;
  title: string;
  description: string;
  button_label: string;
  embed_color?: string | null;
  embed_thumbnail?: string | null;
  embed_image?: string | null;
  embed_footer?: string | null;
  min_amount: number;
  max_amount: number; // 0 = no maximum
  donor_role_id: string;
  role_min_total: number;
  announce: boolean;
  dm_thanks: boolean;
  bump_panel: boolean;
}

interface DonationStats {
  total_raised: string;
  donation_count: number;
  donor_count: number;
  recent: { user_id: string; amount: string; note: string; finished_at?: string }[];
}

interface DonationsResponse {
  settings: DonationSettings;
  stats: DonationStats;
  paypal: { configured: boolean; sandbox: boolean };
}

const LABEL = "mb-2 block text-xs font-semibold text-discord-text-muted uppercase tracking-wide";

export default function DonationsPage({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = use(params);
  const { toast } = useToast();

  const [settings, setSettings] = useState<DonationSettings | null>(null);
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [paypal, setPaypal] = useState<DonationsResponse["paypal"] | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autoState, setAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const lastSavedRef = useRef("");

  // message_id is set by publishing, not by editing, so it never counts as an unsaved change.
  const comparable = (s: DonationSettings) => JSON.stringify({ ...s, message_id: undefined });

  useEffect(() => {
    fetchApi(`/guilds/${guildId}/donations`)
      .then((data: DonationsResponse) => {
        lastSavedRef.current = comparable(data.settings);
        setSettings(data.settings);
        setStats(data.stats);
        setPaypal(data.paypal);
      })
      .catch(() => toast("Failed to load donation settings", "error"));
  }, [guildId, toast]);

  // Auto-save: persist 800ms after the last edit. Invalid limits are skipped (manual save explains why).
  useEffect(() => {
    if (!settings) return;
    const snapshot = comparable(settings);
    if (snapshot === lastSavedRef.current) return;
    if (settings.min_amount < 1 || (settings.max_amount > 0 && settings.max_amount < settings.min_amount)) return;

    const timer = setTimeout(async () => {
      setAutoState("saving");
      try {
        await fetchApi(`/guilds/${guildId}/donations`, undefined, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        });
        lastSavedRef.current = snapshot;
        setAutoState("saved");
      } catch {
        setAutoState("error");
      }
    }, 800);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, guildId]);

  if (!settings) {
    return <div className="glass-card rounded-3xl p-6 text-discord-text-muted">Loading...</div>;
  }

  const update = <K extends keyof DonationSettings>(key: K, val: DonationSettings[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: val } : prev));

  const toNumber = (raw: string) => {
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  };

  const handleSave = async (): Promise<boolean> => {
    if (settings.min_amount < 1) {
      toast("Minimum amount cannot be below 1 EUR.", "error");
      return false;
    }
    if (settings.max_amount > 0 && settings.max_amount < settings.min_amount) {
      toast("Maximum must be empty (no limit) or at least the minimum.", "error");
      return false;
    }
    setSaving(true);
    try {
      await fetchApi(`/guilds/${guildId}/donations`, undefined, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      lastSavedRef.current = comparable(settings);
      setAutoState("saved");
      toast("Donation settings saved!");
      return true;
    } catch (e: any) {
      toast(e?.message || "Failed to save settings.", "error");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!settings.channel_id) {
      toast("Select a panel channel first.", "error");
      return;
    }
    if (!(await handleSave())) return;
    setPublishing(true);
    try {
      const res = await fetchApi(`/trigger/donation_publish`, undefined, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guild_id: guildId, payload: {} }),
      });
      if (res?.message_id) update("message_id", String(res.message_id));
      toast(res?.message || "Panel published.");
    } catch (e: any) {
      toast(`Failed to publish panel: ${e.message}`, "error");
    } finally {
      setPublishing(false);
    }
  };

  const live = !!settings.message_id;

  return (
    <div className="glass-card flex flex-col gap-6 rounded-3xl p-4 sm:p-6">
      <DashboardPageHero
        icon={Heart}
        title="Donations"
        subtitle="PayPal donation panel. Members donate any amount between your minimum and maximum, and can get a donor role."
        stats={[
          { label: "Total Raised", value: `€${stats?.total_raised ?? "0.00"}` },
          { label: "Donations", value: stats?.donation_count ?? 0 },
          { label: "Donors", value: stats?.donor_count ?? 0 },
          {
            label: "PayPal",
            value: !paypal?.configured ? "Not configured" : paypal.sandbox ? "Sandbox (test)" : "Live",
          },
        ]}
        actions={
          <>
            {autoState !== "idle" && (
              <span className={`text-xs ${autoState === "error" ? "text-red-400" : "text-green-400"}`}>
                {autoState === "saving" ? "Saving..." : autoState === "saved" ? "All changes saved" : "Auto-save failed"}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
            <Button variant="discord" size="sm" onClick={handlePublish} disabled={publishing}>
              {publishing ? "Publishing..." : live ? "Update Live Panel" : "Post Panel"}
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Amount Limits (EUR)</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Minimum (at least 1)</label>
            <Input
              type="number"
              min={1}
              step="0.5"
              value={settings.min_amount}
              onChange={(e) => update("min_amount", toNumber(e.target.value))}
            />
          </div>
          <div>
            <label className={LABEL}>Maximum (empty or 0 = no limit)</label>
            <Input
              type="number"
              min={0}
              step="1"
              value={settings.max_amount || ""}
              placeholder="No maximum"
              onChange={(e) => update("max_amount", toNumber(e.target.value))}
            />
          </div>
        </div>
        <p className="mt-2 text-[10px] text-discord-text-muted">
          Limits apply as soon as they are saved (changes auto-save). Donors see them in the amount pop-up.
        </p>
      </div>

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Channels & Behaviour</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Panel Channel</label>
            <ChannelSelect
              guildId={guildId}
              value={settings.channel_id || ""}
              onChange={(id) => update("channel_id", id)}
              placeholder="Post donation panel in..."
            />
          </div>
          <div>
            <label className={LABEL}>Thank-you Channel (default: panel channel)</label>
            <ChannelSelect
              guildId={guildId}
              value={settings.announce_channel_id || ""}
              onChange={(id) => update("announce_channel_id", id)}
              placeholder="Announce donations in..."
            />
          </div>
          <div>
            <label className={LABEL}>Button Label</label>
            <Input
              value={settings.button_label || ""}
              onChange={(e) => update("button_label", e.target.value)}
              placeholder="Donate"
            />
          </div>
          <div className="flex flex-col justify-end gap-2 text-sm text-discord-text">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.enabled} onChange={(e) => update("enabled", e.target.checked)} />
              Donations enabled
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.announce} onChange={(e) => update("announce", e.target.checked)} />
              Announce donations in the thank-you channel
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.dm_thanks} onChange={(e) => update("dm_thanks", e.target.checked)} />
              DM the donor a thank-you
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.bump_panel} onChange={(e) => update("bump_panel", e.target.checked)} />
              Keep panel at the bottom (re-post it under each thank-you)
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Donor Role</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={LABEL}>Role given to donors</label>
            <RoleSelect
              guildId={guildId}
              value={settings.donor_role_id || ""}
              onChange={(id) => update("donor_role_id", id)}
              placeholder="No role"
            />
          </div>
          <div>
            <label className={LABEL}>Total donated needed (EUR, 0 = any donation)</label>
            <Input
              type="number"
              min={0}
              step="1"
              value={settings.role_min_total || ""}
              placeholder="0"
              onChange={(e) => update("role_min_total", toNumber(e.target.value))}
            />
          </div>
        </div>
        <p className="mt-2 text-[10px] text-discord-text-muted">
          The bot&apos;s role must sit above the donor role in the role list. The threshold counts everything a member has
          donated in total.
        </p>
      </div>

      <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
        <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Panel Message</h3>
        <AdvancedEmbedEditor
          config={{
            title: settings.title,
            description: settings.description,
            color: settings.embed_color ?? "",
            thumbnail_url: settings.embed_thumbnail || "",
            image_url: settings.embed_image || "",
            footer: settings.embed_footer ?? "",
          }}
          onChange={(k, val) => {
            if (k === "title") update("title", val);
            else if (k === "description") update("description", val);
            else if (k === "color") update("embed_color", val);
            else if (k === "thumbnail_url") update("embed_thumbnail", val);
            else if (k === "image_url") update("embed_image", val);
            else if (k === "footer") update("embed_footer", val);
          }}
        />
      </div>

      {stats && stats.recent.length > 0 && (
        <div className="rounded-xl border border-[#1E1F22] bg-[#2B2D31] p-6">
          <h3 className="mb-4 text-xs font-bold text-discord-text-muted uppercase tracking-wide">Recent Donations</h3>
          <div className="flex flex-col gap-2 text-sm">
            {stats.recent.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[#1E1F22] px-3 py-2">
                <span className="font-mono text-discord-text-muted">{d.user_id}</span>
                <span className="font-semibold text-white">€{d.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
