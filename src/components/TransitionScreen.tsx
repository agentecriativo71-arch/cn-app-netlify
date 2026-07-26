import { useEffect } from "react";
import type { TransitionMessage } from "@/lib/transitionMessages";

interface TransitionScreenProps {
  message: TransitionMessage;
  onComplete: () => void;
  duration?: number;
}

export function TransitionScreen({
  message,
  onComplete,
  duration = 1800,
}: TransitionScreenProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onComplete]);

  return (
    <div
      onClick={onComplete}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 cursor-pointer select-none overflow-hidden animate-in fade-in duration-300"
      style={{
        background: "radial-gradient(circle at center, rgba(3, 102, 53, 0.95) 0%, rgba(2, 42, 26, 0.98) 100%)",
        backdropFilter: "blur(16px)",
      }}
    >
      {/* Decorative ambient glow */}
      <div
        className="absolute w-[350px] h-[350px] rounded-full opacity-25 pointer-events-none animate-pulse"
        style={{
          background: "radial-gradient(circle, #E5D3A2 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm space-y-6">
        {/* Animated Emoji Badge */}
        <div className="w-20 h-20 rounded-3xl bg-white/10 border border-[#E5D3A2]/30 flex items-center justify-center text-4xl shadow-2xl backdrop-blur-md animate-bounce">
          {message.emoji}
        </div>

        {/* Dynamic Title */}
        <h3
          className="text-2xl sm:text-3xl font-extrabold text-[#E6DEC9] tracking-tight leading-tight uppercase"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {message.title}
        </h3>

        {/* Subtitle */}
        <p className="text-sm sm:text-base font-medium text-white/85 leading-relaxed">
          {message.subtitle}
        </p>

        {/* Progress bar line */}
        <div className="w-36 h-1 bg-white/15 rounded-full overflow-hidden mt-4">
          <div
            className="h-full bg-gradient-to-r from-[#E6DEC9] to-[#E5D3A2] rounded-full transition-all ease-linear"
            style={{
              animation: `progressFill ${duration}ms linear forwards`,
            }}
          />
        </div>

        <span className="text-[11px] uppercase tracking-widest text-white/40 font-semibold pt-2">
          Toque para continuar
        </span>
      </div>

      <style>{`
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
