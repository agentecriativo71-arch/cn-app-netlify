import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { sendWhatsAppLookFn, updateLookDbFn } from "@/server/api";
import { useLook } from "@/lib/store";

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  croquiUrl: string;
  realistaUrl: string | null;
  dbId: string | null;
}

export function WhatsAppModal({ open, onClose, croquiUrl, realistaUrl, dbId }: WhatsAppModalProps) {
  const s = useLook();
  const nome = s.nome || "";
  const [telefone, setTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;
    setSubmitting(true);
    try {
      try {
        if (dbId) {
          await updateLookDbFn({
            data: {
              id: dbId,
              update: { nome_cliente: nome, telefone_cliente: telefone },
            },
          });
        }
      } catch (dbErr) {
        console.warn("[DB] Failed to update lead:", dbErr);
      }

      await sendWhatsAppLookFn({
        data: {
          nome,
          telefone,
          croquiUrl,
          realistaUrl,
          peca: s.peca,
          ocasiao: s.ocasiao,
          biotipo: s.biotipo,
          comprimento: s.comprimento,
          decote: s.decote,
          manga: s.manga,
          cor: s.cor,
          comentario: s.comentario
        },
      });

      setSaved(true);
      setTimeout(() => {
        onClose();
        setSaved(false);
        setTelefone("");
      }, 3000);
    } catch (err) {
      console.error("Erro ao enviar:", err);
      alert("Erro ao enviar. Por favor, verifique o número e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-primary">
            <MessageCircle size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Receber no WhatsApp</h3>
            <p className="text-[11px] text-muted-foreground">
              Enviaremos {realistaUrl ? "o croqui e a foto realista" : "o croqui"} para seu número.
            </p>
          </div>
        </div>

        {saved ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-primary flex items-center justify-center mb-3">
              <span className="text-white text-xl">✓</span>
            </div>
            <p className="text-primary font-semibold text-sm">Enviado! Verifique o seu WhatsApp.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                WhatsApp (com DDD)
              </label>
              <input
                type="tel"
                required
                placeholder="Ex: 19999999999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full p-3.5 border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary py-3 text-sm flex-1"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary py-3 text-sm flex-1"
                disabled={submitting || !nome || !telefone}
              >
                {submitting ? "Enviando..." : "Enviar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
