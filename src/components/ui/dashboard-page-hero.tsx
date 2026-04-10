import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface HeroStat {
  label: string;
  value: string | number;
}

interface DashboardPageHeroProps {
  title: string;
  subtitle: string;
  icon?: LucideIcon;
  stats?: HeroStat[];
  actions?: ReactNode;
  className?: string;
}

export function DashboardPageHero({
  title,
  subtitle,
  icon: Icon,
  stats = [],
  actions,
  className,
}: DashboardPageHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(135deg,rgba(24,24,27,0.92),rgba(16,16,18,0.96))]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_90%_10%,rgba(168,168,168,0.12),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border border-white/14 bg-[rgba(31,31,35,0.92)] text-white/90">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-discord-text-muted">{subtitle}</p>
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {stats.length > 0 && (
        <div className="relative grid gap-3 border-t border-white/10 px-5 py-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-white/10 bg-[rgba(24,24,27,0.82)] px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-discord-text-muted">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
