"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import {
  BotIcon,
  MessageSquareReplyIcon,
  ShieldAlertIcon,
  TicketIcon,
  GiftIcon,
  UsersIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "lucide-react";
import { DashboardPageHero } from "@/components/ui/dashboard-page-hero";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchApi } from "@/lib/api";

type GuildHomeData = {
  autoreplyCount: number;
  automodEnabled: boolean;
  ticketPanels: number;
  giveawayCount: number;
  memberCounterEnabled: boolean;
};

const quickLinks = [
  {
    title: "Auto Reply",
    description: "Create keyword-based smart responses for support and FAQs.",
    href: "autoreply",
    icon: MessageSquareReplyIcon,
  },
  {
    title: "Auto Moderation",
    description: "Configure anti-spam, filters, and moderation automation.",
    href: "automod",
    icon: ShieldAlertIcon,
  },
  {
    title: "Tickets",
    description: "Set up support ticket panels and category routing.",
    href: "tickets",
    icon: TicketIcon,
  },
  {
    title: "Giveaways",
    description: "Run giveaways with winners, key delivery, and logs.",
    href: "giveaways",
    icon: GiftIcon,
  },
];

export default function DashboardGuildHomePage({ params }: { params: Promise<{ guildId: string }> }) {
  const resolvedParams = use(params);
  const guildId = resolvedParams.guildId;
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<GuildHomeData>({
    autoreplyCount: 0,
    automodEnabled: false,
    ticketPanels: 0,
    giveawayCount: 0,
    memberCounterEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [autoreply, automod, tickets, giveaways, memberCounter] = await Promise.allSettled([
          fetchApi(`/guilds/${guildId}/autoreply`),
          fetchApi(`/guilds/${guildId}/automod`),
          fetchApi(`/guilds/${guildId}/tickets`),
          fetchApi(`/guilds/${guildId}/giveaways`),
          fetchApi(`/guilds/${guildId}/member-counter`),
        ]);

        if (cancelled) return;

        const autoreplyValue =
          autoreply.status === "fulfilled" && Array.isArray(autoreply.value) ? autoreply.value.length : 0;
        const automodEnabled =
          automod.status === "fulfilled" ? Boolean(automod.value?.enabled) : false;
        const ticketPanels =
          tickets.status === "fulfilled" && Array.isArray(tickets.value?.panels) ? tickets.value.panels.length : 0;
        const giveawayCount =
          giveaways.status === "fulfilled" && Array.isArray(giveaways.value) ? giveaways.value.length : 0;
        const memberCounterEnabled =
          memberCounter.status === "fulfilled" ? Boolean(memberCounter.value?.enabled) : false;

        setStats({
          autoreplyCount: autoreplyValue,
          automodEnabled,
          ticketPanels,
          giveawayCount,
          memberCounterEnabled,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [guildId]);

  const readiness = useMemo(() => {
    let score = 0;
    if (stats.autoreplyCount > 0) score += 1;
    if (stats.automodEnabled) score += 1;
    if (stats.ticketPanels > 0) score += 1;
    if (stats.giveawayCount > 0) score += 1;
    if (stats.memberCounterEnabled) score += 1;
    return `${score}/5`;
  }, [stats]);

  return (
    <div className="flex flex-col gap-5">
      <DashboardPageHero
        icon={BotIcon}
        title="Dashboard Home"
        subtitle="Welcome to your server control center. Start here to configure core bot systems and monitor setup status."
        stats={[
          { label: "Auto Replies", value: stats.autoreplyCount },
          { label: "AutoMod", value: stats.automodEnabled ? "Enabled" : "Disabled" },
          { label: "Ticket Panels", value: stats.ticketPanels },
          { label: "Setup Readiness", value: readiness },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={`/dashboard/${guildId}/${item.href}`}>
              <Card className="h-full transition hover:border-white/30">
                <CardHeader>
                  <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-white/12 bg-[rgba(31,31,35,0.9)] text-white/90">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-white">{item.title}</CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center gap-2 text-sm text-white/85">
                    Open module
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <UsersIcon className="h-5 w-5 text-white/90" />
            Introduction
          </CardTitle>
          <CardDescription>What this Home page is for</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-discord-text-muted">
          <p>
            This page gives you a quick overview of server setup and shortcuts to the modules you use most.
            It is designed as a landing page for the dashboard, not a config editor.
          </p>
          <p>
            Use the sidebar to open full configuration pages for automation, operations, and moderation workflows.
            The metrics above help you confirm whether core systems are already configured.
          </p>
          {loading && (
            <p className="inline-flex items-center gap-2 text-discord-text">
              <SparklesIcon className="h-4 w-4 text-white/90" />
              Loading live module stats...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
