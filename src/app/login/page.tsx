import { BotIcon, CheckCircle2Icon, LockIcon, SparklesIcon } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  no_code: "Discord did not return an authorization code. Please try signing in again.",
  auth_failed: "Discord authentication failed. Your session may have expired.",
  no_session: "Session setup was interrupted. Please log in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const resolvedParams = await searchParams;
  const errorText = resolvedParams.error ? ERROR_MESSAGES[resolvedParams.error] ?? "Unable to log you in right now." : null;
  const nextPath = typeof resolvedParams.next === "string" && resolvedParams.next.startsWith("/")
    ? resolvedParams.next
    : undefined;
  const loginHref = nextPath
    ? `/api/auth/discord/login?next=${encodeURIComponent(nextPath)}`
    : "/api/auth/discord/login";

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-6 page-enter lg:grid-cols-[1.15fr_0.85fr]">
        <section className="glass-card hidden rounded-3xl p-8 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-discord-blurple/40 bg-discord-blurple/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-discord-blurple">
              <SparklesIcon className="h-3.5 w-3.5" />
              Seisen Dashboard
            </div>

            <h1 className="title-glow text-5xl font-bold leading-tight text-white">
              Manage Your Bot
              <br />
              Like a Product Team.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-discord-text-muted">
              Configure automation, AI support, tickets, boost systems, and channel workflows from one focused control plane.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ["Secure OAuth", "Discord sign-in with httpOnly session cookies."],
              ["Guild Smart Routing", "Manage only the servers where you have control."],
              ["Always-On Modules", "AI, tickets, announcements, and automations in one place."],
            ].map(([title, desc]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.8)] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <CheckCircle2Icon className="h-4 w-4 text-discord-green" />
                  {title}
                </div>
                <p className="text-xs leading-relaxed text-discord-text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card rounded-3xl p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-discord-text-muted">Seisen Hub Access</p>
              <h2 className="mt-1 text-3xl font-bold text-white">Sign In</h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[rgba(19,23,33,0.9)] text-discord-blurple">
              <BotIcon className="h-5 w-5" />
            </div>
          </div>

          <p className="mb-5 text-sm leading-relaxed text-discord-text-muted">
            Use Discord OAuth to continue to your server dashboard. We only request identity and guild access.
          </p>

          {errorText && (
            <div className="mb-5 rounded-2xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white/90">
              {errorText}
            </div>
          )}

          <a
            href={loginHref}
            className="group relative flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#a3a7b0] to-[#737781] px-4 text-sm font-bold text-white shadow-[0_10px_28px_rgba(13,15,20,0.5)] transition-transform hover:-translate-y-0.5"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M20.317 4.3698a19.791 19.791 0 0 0-4.8851-1.5152.074.074 0 0 0-.0785.0371 13.587 13.587 0 0 0-.6084 1.2648 18.27 18.27 0 0 0-5.487 0 13.134 13.134 0 0 0-.6171-1.2648.077.077 0 0 0-.0785-.037A19.736 19.736 0 0 0 3.677 4.3698a.066.066 0 0 0-.0315.0276C.5334 9.0467-.32 13.5799.099 18.0578a.082.082 0 0 0 .0315.0561 19.924 19.924 0 0 0 6.0409 3.0615.078.078 0 0 0 .0842-.0276 14.091 14.091 0 0 0 1.2352-1.9942.076.076 0 0 0-.0416-.1057 13.107 13.107 0 0 1-1.872-.8923.077.077 0 0 1-.0077-.1277c.1258-.0943.2498-.1923.3689-.2914a.074.074 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0617 0a.074.074 0 0 1 .0789.0094c.119.0991.2431.1981.369.2924a.077.077 0 0 1-.0066.1276 12.299 12.299 0 0 1-1.873.8923.076.076 0 0 0-.0409.1067c.3604.698.775 1.3588 1.2408 1.993a.076.076 0 0 0 .0842.0286 19.907 19.907 0 0 0 6.0419-3.0615.082.082 0 0 0 .0315-.0552c.5004-5.177-.838-9.6739-3.5485-13.6607a.061.061 0 0 0-.0315-.028Z" />
              <path d="M8.02 15.331c-1.183 0-2.158-1.086-2.158-2.419 0-1.334.956-2.419 2.158-2.419 1.211 0 2.167 1.095 2.158 2.419 0 1.333-.957 2.419-2.158 2.419Zm7.975 0c-1.183 0-2.158-1.086-2.158-2.419 0-1.334.956-2.419 2.158-2.419 1.211 0 2.167 1.095 2.158 2.419 0 1.333-.947 2.419-2.158 2.419Z" />
            </svg>
            Continue with Discord
            <span className="absolute inset-0 rounded-xl border border-white/20" />
          </a>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[rgba(20,24,34,0.75)] px-4 py-3 text-xs text-discord-text-muted">
            <div className="mb-1 flex items-center gap-2 font-semibold text-white">
              <LockIcon className="h-3.5 w-3.5 text-discord-green" />
              Session Security
            </div>
            Tokens stay in secure browser storage and are used only for authenticated dashboard actions.
          </div>
        </section>
      </div>
    </div>
  );
}
