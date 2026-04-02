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
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold ring-offset-background transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-discord-blurple/60 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-gradient-to-r from-discord-blurple to-[#4f8ff7] text-white shadow-[0_8px_24px_rgba(45,196,183,0.34)] hover:-translate-y-0.5 hover:brightness-105":
              variant === "default" || variant === "discord",
            "bg-discord-red text-white hover:-translate-y-0.5 hover:brightness-105": variant === "destructive",
            "border border-white/15 bg-[#112136] text-discord-text hover:border-discord-blurple/40 hover:bg-[#16304b]":
              variant === "outline",
            "bg-[#132337] text-discord-text hover:bg-[#1a334f]": variant === "secondary",
            "text-discord-text-muted hover:bg-white/8 hover:text-white": variant === "ghost",
            "text-discord-blurple underline-offset-4 hover:underline": variant === "link",
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
