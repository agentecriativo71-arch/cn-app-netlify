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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-[480px] flex flex-col items-center text-center">
        {/* Floating & Breathing logo container */}
        <div className="logo-float mb-12">
          <img 
            src={crispimLogo} 
            alt="Lojas Crispim" 
            className="w-full max-w-[380px] h-auto object-contain" 
          />
        </div>

        {/* Progress Display */}
        <div className="w-full max-w-[280px] space-y-4">
          <div className="font-mono text-3xl font-bold text-primary tracking-wider">
            {Math.floor(progress)}%
          </div>

          {/* Progress track */}
          <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-75"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-[14px] text-muted-foreground font-medium tracking-wide">
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
        .logo-float {
          animation: logoFloat 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
