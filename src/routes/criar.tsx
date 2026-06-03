import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook, LookState } from "@/lib/store";
import { ImageOff } from "lucide-react";
import elementosData from "@/lib/elementos_vestuario.json";

export const Route = createFileRoute("/criar")({
  component: Criar,
  head: () => ({ meta: [{ title: "Criar look — C&N Tecidos" }] }),
});

const OCASIOES = ["Casamento", "Festa", "Trabalho", "Casual", "Gala"];
const BIOTIPOS = ["Ampulheta", "Triângulo", "Triângulo Invertido", "Retângulo", "Oval"];
const PECAS = ["Vestido", "Saia", "Blusa", "Calça", "Macacão"];
const COMPRIMENTOS = ["Curto", "Médio", "Longo", "Midi"];

// Elementos por categoria que possuem imagem
const MANGAS = elementosData.filter(e => e.categoria === "manga" && e.image_url);
const DECOTES = elementosData.filter(e => e.categoria === "decote" && e.image_url);
const SAIAS = elementosData.filter(e => e.categoria === "saia" && e.image_url);
const RENDAS = elementosData.filter(e => e.categoria === "renda" && e.image_url);

// ── Componentes ──────────────────────────────────────────────────────────────

function Section({ title, children, hint }: {
  title: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <h2 className="h2-section">{title}</h2>
        {hint && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Linha simples de chips (para seções sem imagem) */
function ChipRow({ items, selected, onSelect }: {
  items: string[]; selected: string | null; onSelect: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(item => (
        <button
          key={item}
          className="chip"
          data-selected={selected === item}
          onClick={() => onSelect(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}

/** Grid de cards com imagem + descrição (para Manga, Decote, Saia, Renda) */
function ElementGrid({ items, selected, onSelect }: {
  items: typeof MANGAS;
  selected: string | null;
  onSelect: (nome: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(el => {
        const isSelected = selected === el.nome;
        return (
          <button
            key={el.id}
            onClick={() => onSelect(isSelected ? "" : el.nome)}
            className="w-full h-44 border rounded-xl overflow-hidden transition-all duration-200 bg-white flex items-center justify-center p-3"
            style={{
              borderColor: isSelected ? "var(--color-primary)" : "var(--color-border)",
              boxShadow: isSelected ? "0 0 0 2px var(--color-primary)" : "var(--shadow-card)",
            }}
          >
            {el.image_url ? (
              <img
                src={el.image_url}
                alt={el.nome}
                className="max-w-full max-h-full object-contain"
                loading="lazy"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <ImageOff size={20} className="opacity-40" />
                <span className="text-[9px] opacity-50 uppercase tracking-wider">Sem imagem</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

function Criar() {
  const router = useRouter();
  const s = useLook();

  const valid = s.peca && s.biotipo;

  // Condicionais de exibição baseadas na peça principal selecionada
  const showComprimento = s.peca === "Vestido" || s.peca === "Saia";
  const showDecote = s.peca === "Vestido" || s.peca === "Blusa" || s.peca === "Macacão";
  const isSleevelessDecote = s.decote === "Frente Única" || s.decote === "Coração (Sweetheart)" || s.decote === "Tomara que Caia";
  const showManga = (s.peca === "Vestido" || s.peca === "Blusa" || s.peca === "Macacão") && !isSleevelessDecote;
  const showSaia = s.peca === "Vestido" || s.peca === "Saia";
  const showRenda = RENDAS.length > 0 && (s.peca === "Vestido" || s.peca === "Saia" || s.peca === "Blusa");

  const submit = () => {
    if (!valid) return;
    s.set({ croquiUrl: null, realistaUrl: null, dbId: null });
    router.navigate({ to: "/croqui" });
  };

  return (
    <>
      <Header title="Nova Criação" back="/" />
      <main className="px-5 py-6 space-y-8 pb-32 fade-in">

        <Section title="Ocasião">
          <ChipRow items={OCASIOES} selected={s.ocasiao} onSelect={(v) => s.set({ ocasiao: v })} />
        </Section>

        <Section title="Peça principal" hint="Obrigatório">
          <ChipRow items={PECAS} selected={s.peca} onSelect={(v) => {
            // Limpa as escolhas que não fazem sentido ao trocar de peça
            const patch: Partial<LookState> = { peca: v };
            if (v === "Saia") {
              patch.decote = null;
              patch.manga = null;
            } else if (v === "Blusa" || v === "Macacão") {
              patch.saia = null;
              patch.comprimento = null;
            } else if (v === "Calça") {
              patch.decote = null;
              patch.manga = null;
              patch.saia = null;
              patch.comprimento = null;
            }
            s.set(patch);
          }} />
        </Section>

        <Section title="Seu biotipo" hint="Obrigatório">
          <ChipRow items={BIOTIPOS} selected={s.biotipo} onSelect={(v) => s.set({ biotipo: v })} />
        </Section>

        {showComprimento && (
          <Section title="Comprimento">
            <ChipRow items={COMPRIMENTOS} selected={s.comprimento} onSelect={(v) => s.set({ comprimento: v })} />
          </Section>
        )}

        {showDecote && DECOTES.length > 0 && (
          <Section title="Decote" hint="Toque para escolher">
            <ElementGrid
              items={DECOTES}
              selected={s.decote}
              onSelect={(nome) => {
                const isSleeveless = nome === "Frente Única" || nome === "Coração (Sweetheart)" || nome === "Tomara que Caia";
                s.set({
                  decote: nome || null,
                  ...(isSleeveless ? { manga: null } : {})
                });
              }}
            />
          </Section>
        )}

        {showManga && MANGAS.length > 0 && (
          <Section title="Manga" hint="Toque para escolher">
            <ElementGrid
              items={MANGAS}
              selected={s.manga}
              onSelect={(nome) => s.set({ manga: nome || null })}
            />
          </Section>
        )}

        {showSaia && SAIAS.length > 0 && (
          <Section title="Modelo de Saia" hint="Toque para escolher">
            <ElementGrid
              items={SAIAS}
              selected={s.saia}
              onSelect={(nome) => s.set({ saia: nome || null })}
            />
          </Section>
        )}

        {showRenda && RENDAS.length > 0 && (
          <Section title="Detalhes em Renda" hint="Opcional">
            <ElementGrid
              items={RENDAS}
              selected={s.renda}
              onSelect={(nome) => s.set({ renda: nome || null })}
            />
          </Section>
        )}

        <Section title="Observações ou detalhes extras" hint="Opcional">
          <textarea
            className="w-full min-h-[90px] p-3 border rounded-xl bg-card text-foreground placeholder:text-muted-foreground text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            placeholder="Ex: Gostaria de um laço grande nas costas, caimento esvoaçante ou cinto fino..."
            value={s.comentario || ""}
            onChange={(e) => s.set({ comentario: e.target.value || null })}
          />
        </Section>

      </main>

      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-background/95 backdrop-blur border-t">
        <button className="btn-primary" disabled={!valid} onClick={submit}>
          ✨ Gerar croqui
        </button>
      </div>
    </>
  );
}
