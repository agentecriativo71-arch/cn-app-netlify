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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-6 backdrop-blur-md animate-in fade-in duration-300">
      {/* Background soft ambient glow */}
      <div 
        className="absolute w-96 h-96 rounded-full pointer-events-none opacity-20 filter blur-3xl"
        style={{
          background: "radial-gradient(circle, #00c853 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[340px] flex flex-col items-center text-center">
        {/* Breathing logo container */}
        <div className="logo-pulse mb-8 overflow-hidden rounded-xl bg-white p-4 shadow-xl">
          <img 
            src={crispimLogo} 
            alt="Lojas Crispim" 
            className="w-full max-w-[220px] h-auto object-contain" 
          />
        </div>

        {/* Progress Display */}
        <div className="w-full space-y-4">
          <div className="font-mono text-2xl font-semibold text-emerald-400 tracking-wider">
            {Math.floor(progress)}%
          </div>

          {/* Progress track */}
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-[14px] text-emerald-200/70 font-medium tracking-wide">
            {statusText}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes logoPulse {
          0%, 100% {
            transform: scale(0.97);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1), 0 0 15px rgba(16, 185, 129, 0.1);
          }
          50% {
            transform: scale(1.03);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15), 0 0 25px rgba(16, 185, 129, 0.25);
          }
        }
        .logo-pulse {
          animation: logoPulse 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
