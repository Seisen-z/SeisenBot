import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "discord";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-[#a3a7b0] to-[#757982] text-white shadow-[0_8px_22px_rgba(0,0,0,0.42)] hover:brightness-105":
              variant === "default" || variant === "discord",
            "bg-discord-red text-white hover:-translate-y-0.5 hover:brightness-105": variant === "destructive",
            "border border-white/15 bg-[rgba(24,24,27,0.94)] text-discord-text hover:border-white/30 hover:bg-[rgba(34,34,38,0.96)]":
              variant === "outline",
            "bg-[rgba(28,28,32,0.94)] text-discord-text hover:bg-[rgba(36,36,41,0.96)]": variant === "secondary",
            "text-discord-text-muted hover:bg-white/8 hover:text-white": variant === "ghost",
            "text-white/85 underline-offset-4 hover:text-white hover:underline": variant === "link",
            "h-10 px-4 py-2": size === "default",
            "h-9 rounded-lg px-3 text-xs": size === "sm",
            "h-11 rounded-xl px-8": size === "lg",
            "h-10 w-10": size === "icon",
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
