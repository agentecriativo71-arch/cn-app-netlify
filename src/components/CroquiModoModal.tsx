import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Upload, Sparkles, Smartphone, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { createUploadSessionFn, pollUploadSessionFn } from "@/server/api";
import { useLook } from "@/lib/store";
import { useRouter } from "@tanstack/react-router";

interface CroquiModoModalProps {
  open: boolean;
  nome: string;
  onClose: () => void;
  onSelectCriarDoZero: () => void;
}

export function CroquiModoModal({ open, nome, onClose, onSelectCriarDoZero }: CroquiModoModalProps) {
  const router = useRouter();
  const s = useLook();
  const [step, setStep] = useState<"choice" | "qr">("choice");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep("choice");
      setSessionId(null);
      setLoadingSession(false);
      setUploadSuccess(false);
    }
  }, [open]);

  // Polling quando está no passo de QR Code
  useEffect(() => {
    if (step !== "qr" || !sessionId || uploadSuccess) return;

    const interval = setInterval(async () => {
      try {
        const res = await pollUploadSessionFn({ data: { sessionId } });
        if (res.session && res.session.status === "uploaded" && res.session.croqui_url) {
          setUploadSuccess(true);
          s.set({
            croquiUrl: res.session.croqui_url,
            croquiUploadSessionId: sessionId,
          });

          // Navega diretamente para /realista após 1.2s de feedback
          setTimeout(() => {
            onClose();
            router.navigate({ to: "/realista" });
          }, 1200);
        }
      } catch (err) {
        console.error("[POLL] Erro ao consultar sessão:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [step, sessionId, uploadSuccess]);

  if (!open) return null;

  const handleStartUploadFlow = async () => {
    setLoadingSession(true);
    try {
      const res = await createUploadSessionFn({ data: { nomeCliente: nome } });
      if (res.session?.id) {
        setSessionId(res.session.id);
        setStep("qr");
      }
    } catch (err) {
      console.error("[SESSION] Erro ao criar sessão de upload:", err);
    } finally {
      setLoadingSession(false);
    }
  };

  const uploadUrl = typeof window !== "undefined" && sessionId ? `${window.location.origin}/upload/${sessionId}` : "";

  return (
    <div className="modal-overlay z-50" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card max-w-lg space-y-6 text-center select-none fade-in">
        {step === "choice" ? (
          <>
            <div className="space-y-2">
              <span
                className="text-[11px] tracking-[0.3em] font-semibold text-[#E5D3A2] uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                C&N TECIDOS
              </span>
              <h3
                className="text-2xl font-extrabold text-[#E6DEC9] tracking-tight uppercase"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Olá, {nome}!
              </h3>
              <p className="text-sm text-white/70 max-w-xs mx-auto">
                Você já possui a foto ou print de um croqui que deseja utilizar, ou prefere criar um do zero?
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleStartUploadFlow}
                disabled={loadingSession}
                className="w-full p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-[#E5D3A2]/40 hover:border-[#E5D3A2] transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#E5D3A2]/20 flex items-center justify-center text-[#E5D3A2] group-hover:scale-105 transition-transform">
                    {loadingSession ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Já tenho um croqui</h4>
                    <p className="text-xs text-white/60">Enviar do celular via QR Code</p>
                  </div>
                </div>
                <Smartphone size={20} className="text-[#E5D3A2] opacity-80" />
              </button>

              <button
                onClick={onSelectCriarDoZero}
                className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-white/30 transition-all flex items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/80 group-hover:scale-105 transition-transform">
                    <Sparkles size={24} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider">Quero criar um novo</h4>
                    <p className="text-xs text-white/60">Desenhar com a Inteligência Artificial</p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={onClose}
              className="text-xs text-white/40 hover:text-white/70 uppercase tracking-widest pt-2"
            >
              Cancelar
            </button>
          </>
        ) : (
          /* Passo 2: Exibição do QR Code */
          <>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <button
                onClick={() => setStep("choice")}
                className="text-white/60 hover:text-white flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <span className="text-xs font-bold text-[#E5D3A2] uppercase tracking-widest">Enviar pelo Celular</span>
              <div className="w-12" />
            </div>

            {uploadSuccess ? (
              <div className="py-8 space-y-4 fade-in">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/40 animate-bounce">
                  <CheckCircle2 size={36} />
                </div>
                <h4 className="text-xl font-bold text-white uppercase tracking-wide">Croqui Recebido!</h4>
                <p className="text-xs text-white/70">Avançando para a foto realista...</p>
              </div>
            ) : (
              <div className="space-y-5 py-2">
                <p className="text-xs text-white/80 max-w-sm mx-auto">
                  Aponte a câmera do seu celular para o QR Code abaixo e envie a foto do seu croqui:
                </p>

                <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl border-4 border-[#E5D3A2]">
                  <QRCodeSVG value={uploadUrl} size={190} level="H" includeMargin={false} />
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-[#E5D3A2] animate-pulse">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Aguardando envio do croqui pelo celular...</span>
                </div>

                <div className="pt-2 text-[10px] text-white/40 break-all max-w-xs mx-auto">
                  Ou acesse no celular: <span className="underline text-white/60">{uploadUrl}</span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
