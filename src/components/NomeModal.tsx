import { useState } from "react";
import { User } from "lucide-react";

interface NomeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (nome: string) => void;
}

export function NomeModal({ open, onClose, onConfirm }: NomeModalProps) {
  const [nome, setNome] = useState("");

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onConfirm(nome.trim());
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-primary">
            <User size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Como podemos te chamar?</h3>
            <p className="text-[11px] text-muted-foreground">
              A Crispim usará seu nome para personalizar sua experiência.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Seu nome ou apelido
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="Ex: Maria, João..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full p-3.5 border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              style={{
                borderColor: "oklch(0.42 0.12 160 / 0.1)",
              }}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-3 text-sm flex-1 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary py-3 text-sm flex-1 font-semibold"
              disabled={!nome.trim()}
            >
              Começar ✨
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
