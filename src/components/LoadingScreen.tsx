import { useEffect, useState } from "react";
import crispimLogo from "@/assets/crispim-logo.png";

interface LoadingScreenProps {
  initialStatus?: string;
  statuses?: string[];
  estimatedDuration?: number; // ms
}

const DEFAULT_STATUSES = [
  "Iniciando processo...",
  "Processando elementos...",
  "Esboçando design...",
  "Aplicando cores e texturas...",
  "Finalizando detalhes..."
];

export function LoadingScreen({
  initialStatus = "Carregando...",
  statuses = DEFAULT_STATUSES,
  estimatedDuration = 10000 // 10 seconds default
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(initialStatus);

  useEffect(() => {
    const startTime = Date.now();
    const intervalTime = 50;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      // Asymptotically approach 99%, will hit 100% when loading resolves (parent component unmounts)
      const calculatedProgress = Math.min(99, (elapsed / estimatedDuration) * 100);
      setProgress(calculatedProgress);

      // Update status text based on progress range
      const statusIndex = Math.min(
        Math.floor((calculatedProgress / 100) * statuses.length),
        statuses.length - 1
      );
      setStatusText(statuses[statusIndex]);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [estimatedDuration, statuses]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 animate-in fade-in duration-300"
      style={{
        background: "radial-gradient(circle at 50% 30%, #044d28 0%, #022a1a 60%, #01190f 100%)",
      }}
    >
      {/* Decorative blobs */}
      <div style={{
        position: "absolute",
        top: "-10%",
        right: "-5%",
        width: "300px",
        height: "300px",
        borderRadius: "50%",
        background: "radial-gradient(circle, oklch(0.88 0.06 160 / 0.1), transparent 70%)",
        filter: "blur(40px)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute",
        bottom: "-10%",
        left: "-5%",
        width: "250px",
        height: "250px",
        borderRadius: "50%",
        background: "radial-gradient(circle, oklch(0.9 0.06 75 / 0.08), transparent 70%)",
        filter: "blur(40px)",
        pointerEvents: "none",
      }} />

      <div className="w-full max-w-[640px] flex flex-col items-center text-center relative z-10">
        {/* Floating & Breathing logo container */}
        <div className="logo-float mb-12">
          <img 
            src={crispimLogo} 
            alt="Lojas Crispim" 
            className="w-full max-w-[480px] sm:max-w-[540px] h-auto object-contain" 
          />
        </div>

        {/* Progress Display */}
        <div className="w-full max-w-[280px] space-y-4">
          <div className="font-bold tracking-wider" style={{
            fontFamily: "var(--font-display)",
            fontSize: "36px",
            background: "linear-gradient(135deg, #E6DEC9, #E5D3A2)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}>
            {Math.floor(progress)}%
          </div>

          {/* Progress track */}
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255, 255, 255, 0.15)" }}>
            <div
              className="h-full rounded-full transition-all duration-75"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #E6DEC9, #E5D3A2)",
              }}
            />
          </div>

          <p className="text-[14px] font-medium tracking-wide text-white/70">
            {statusText}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes logoFloat {
          0%, 100% {
            transform: translateY(0) scale(0.98);
          }
          50% {
            transform: translateY(-10px) scale(1.02);
          }
        }
        @keyframes shiny {
          0% {
            left: -150%;
          }
          40%, 100% {
            left: 150%;
          }
        }
        .logo-float {
          position: relative;
          overflow: hidden;
          animation: logoFloat 4s ease-in-out infinite;
        }
        .logo-float::after {
          content: "";
          position: absolute;
          top: 0;
          left: -150%;
          width: 70%;
          height: 100%;
          background: linear-gradient(
            to right,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.45) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: skewX(-25deg);
          animation: shiny 6s ease-in-out infinite;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
