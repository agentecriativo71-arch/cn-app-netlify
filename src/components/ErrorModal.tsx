import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

interface ErrorModalProps {
  open: boolean;
  message?: string;
  onRetry: () => void;
}

export function ErrorModal({ open, message, onRetry }: ErrorModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    if (!open) return;
    setSecondsLeft(10);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card space-y-5 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center text-red-600 animate-bounce">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-foreground">Ops! Algo deu errado</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {message || "Não conseguimos gerar sua imagem neste momento devido a uma falha de conexão ou processamento."}
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={onRetry}
            className="btn-primary py-3 text-sm w-full font-semibold"
          >
            Tentar novamente
          </button>
          
          {secondsLeft > 0 && (
            <p className="text-[10px] text-muted-foreground mt-3 uppercase tracking-wider font-semibold">
              Esta mensagem ficará visível por mais {secondsLeft}s
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
