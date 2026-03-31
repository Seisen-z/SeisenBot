"use client";

import { useEffect, useState } from "react";

export function HexagonBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="fixed inset-0 bg-[#0e0f13] -z-50" />;

  const hexes = [
    // Large anchors
    { size: 160, top: 5,  left: 6,  duration: 38, delay: 0,   opacity: 0.55, blur: "blur(1px)",  glow: "rgba(88,101,242,0.55)" },
    { size: 120, top: 68, left: 80, duration: 42, delay: -6,  opacity: 0.50, blur: "blur(2px)",  glow: "rgba(88,101,242,0.40)" },
    { size: 140, top: 12, left: 78, duration: 35, delay: -3,  opacity: 0.65, blur: "blur(0px)",  glow: "rgba(114,137,218,0.60)" },
    // Mid-size
    { size: 80,  top: 55, left: 14, duration: 24, delay: 3,   opacity: 0.45, blur: "blur(3px)",  glow: "rgba(88,101,242,0.35)" },
    { size: 65,  top: 84, left: 38, duration: 20, delay: -1,  opacity: 0.40, blur: "blur(5px)",  glow: "rgba(71,82,196,0.40)" },
    { size: 90,  top: 42, left: 91, duration: 28, delay: 5,   opacity: 0.45, blur: "blur(4px)",  glow: "rgba(88,101,242,0.35)" },
    // Small accents
    { size: 42,  top: 28, left: 50, duration: 16, delay: 2,   opacity: 0.30, blur: "blur(6px)",  glow: "rgba(88,101,242,0.25)" },
    { size: 36,  top: 62, left: 60, duration: 19, delay: -4,  opacity: 0.25, blur: "blur(8px)",  glow: "rgba(114,137,218,0.20)" },
    { size: 50,  top: 88, left: 70, duration: 22, delay: 7,   opacity: 0.30, blur: "blur(6px)",  glow: "rgba(88,101,242,0.30)" },
  ];

  return (
    <div
      className="fixed inset-0 -z-50 overflow-hidden"
      style={{ background: "radial-gradient(ellipse at 50% 20%, #12141f 0%, #0a0b10 100%)" }}
    >
      {/* Blurple bloom — top-center */}
      <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-[#5865F2]/[0.06] blur-[120px] pointer-events-none" />
      {/* Soft purple — bottom-left */}
      <div className="absolute -left-32 bottom-0 h-[500px] w-[600px] rounded-full bg-[#4752C4]/[0.06] blur-[140px] pointer-events-none" />
      {/* Indigo accent — right */}
      <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#5865F2]/[0.04] blur-[100px] pointer-events-none" />

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.018]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(88,101,242,0.8) 1px, transparent 1px),
            linear-gradient(90deg, rgba(88,101,242,0.8) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />

      {hexes.map((hex, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{
            top: `${hex.top}%`,
            left: `${hex.left}%`,
            width: `${hex.size}px`,
            height: `${hex.size}px`,
            opacity: hex.opacity,
            animation: `float-hex ${hex.duration}s infinite ease-in-out alternate`,
            animationDelay: `${hex.delay}s`,
            filter: `drop-shadow(0 0 22px ${hex.glow}) ${hex.blur}`,
            willChange: "transform",
          }}
        >
          <div
            className="w-full h-full"
            style={{
              background: "linear-gradient(145deg, #7289da 0%, #5865F2 55%, #4752C4 100%)",
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
            }}
          />
        </div>
      ))}

      <style>{`
        @keyframes float-hex {
          0%   { transform: translate(0px,  0px)   rotate(0deg)   scale(1);    }
          25%  { transform: translate(18px,-28px)  rotate(9deg)   scale(1.04); }
          50%  { transform: translate(-14px,18px)  rotate(-7deg)  scale(0.97); }
          75%  { transform: translate(22px, 8px)   rotate(5deg)   scale(1.02); }
          100% { transform: translate(-8px,-18px)  rotate(-3deg)  scale(1.01); }
        }
      `}</style>
    </div>
  );
}
