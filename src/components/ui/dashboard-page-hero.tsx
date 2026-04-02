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
        "relative overflow-hidden rounded-2xl border border-white/12 bg-[linear-gradient(135deg,rgba(14,30,46,0.82),rgba(10,18,28,0.92))]",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_90%_10%,rgba(45,196,183,0.18),transparent_55%)]" />

      <div className="relative flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/14 bg-[#123049]/70 text-[#2dd5c4]">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            <p className="mt-1 text-sm text-[#b5bac1]">{subtitle}</p>
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {stats.length > 0 && (
        <div className="relative grid gap-3 border-t border-white/10 px-5 py-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl border border-white/8 bg-[#0f1f32]/70 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-[#8b90a0]">{stat.label}</p>
              <p className="mt-1 text-sm font-semibold text-white">{stat.value}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
