import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useLook, LookState } from "@/lib/store";
import { ImageOff, Check, PartyPopper, Shirt, Ruler, MessageSquare } from "lucide-react";
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

// ── Section Icons ────────────────────────────────────────────────
const SECTION_ICONS: Record<string, React.ReactNode> = {
  "Ocasião": <PartyPopper size={16} />,
  "Peça principal": <Shirt size={16} />,
  "Seu biotipo": <span style={{ fontSize: "16px" }}>🧍‍♀️</span>,
  "Comprimento": <Ruler size={16} />,
  "Decote": <span style={{ fontSize: "14px" }}>✂️</span>,
  "Manga": <span style={{ fontSize: "14px" }}>💪</span>,
  "Modelo de Saia": <span style={{ fontSize: "14px" }}>👗</span>,
  "Detalhes em Renda": <span style={{ fontSize: "14px" }}>🪡</span>,
  "Observações ou detalhes extras": <MessageSquare size={16} />,
};

// ── Componentes ──────────────────────────────────────────────────

function Section({ title, children, hint }: {
  title: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <h2 className="h2-section">
          {SECTION_ICONS[title]}
          {title}
        </h2>
        {hint && <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>{hint}</span>}
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
          {selected === item && <Check size={12} strokeWidth={3} />}
          {item}
        </button>
      ))}
    </div>
  );
}

/** Grid de cards com imagem + label */
function ElementGrid({ items, selected, onSelect }: {
  items: typeof MANGAS;
  selected: string | null;
  onSelect: (nome: string) => void;
}) {
  return (
    <div className="element-grid">
      {items.map(el => {
        const isSelected = selected === el.nome;
        return (
          <button
            key={el.id}
            onClick={() => onSelect(isSelected ? "" : el.nome)}
            className="card-element"
            data-selected={isSelected}
          >
            <div className="card-element-image">
              {el.image_url ? (
                <img
                  src={el.image_url}
                  alt={el.nome}
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1" style={{ color: "var(--color-muted-foreground)" }}>
                  <ImageOff size={20} className="opacity-40" />
                  <span className="text-[9px] opacity-50 uppercase tracking-wider">Sem imagem</span>
                </div>
              )}
            </div>
            <div className="card-element-label">{el.nome}</div>
          </button>
        );
      })}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────

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
      <Stepper current="criar" />
      <main className="container-app px-5 py-6 pb-32 fade-in">
        <div className="space-y-6 stagger-children">
          <Section title="Ocasião">
            <ChipRow items={OCASIOES} selected={s.ocasiao} onSelect={(v) => s.set({ ocasiao: v })} />
          </Section>

          <div className="section-divider" />

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
            <>
              <div className="section-divider" />
              <Section title="Comprimento">
                <ChipRow items={COMPRIMENTOS} selected={s.comprimento} onSelect={(v) => s.set({ comprimento: v })} />
              </Section>
            </>
          )}

          {showDecote && DECOTES.length > 0 && (
            <>
              <div className="section-divider" />
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
            </>
          )}

          {showManga && MANGAS.length > 0 && (
            <>
              <div className="section-divider" />
              <Section title="Manga" hint="Toque para escolher">
                <ElementGrid
                  items={MANGAS}
                  selected={s.manga}
                  onSelect={(nome) => s.set({ manga: nome || null })}
                />
              </Section>
            </>
          )}

          {showSaia && SAIAS.length > 0 && (
            <>
              <div className="section-divider" />
              <Section title="Modelo de Saia" hint="Toque para escolher">
                <ElementGrid
                  items={SAIAS}
                  selected={s.saia}
                  onSelect={(nome) => s.set({ saia: nome || null })}
                />
              </Section>
            </>
          )}

          {showRenda && RENDAS.length > 0 && (
            <>
              <div className="section-divider" />
              <Section title="Detalhes em Renda" hint="Opcional">
                <ElementGrid
                  items={RENDAS}
                  selected={s.renda}
                  onSelect={(nome) => s.set({ renda: nome || null })}
                />
              </Section>
            </>
          )}

          <div className="section-divider" />

          <Section title="Observações ou detalhes extras" hint="Opcional">
            <textarea
              className="w-full min-h-[90px] p-3.5 rounded-xl text-[14px] leading-relaxed resize-none transition-all"
              style={{
                border: "1.5px solid oklch(0.42 0.12 160 / 0.1)",
                background: "oklch(1 0 0 / 0.6)",
                backdropFilter: "blur(8px)",
                color: "var(--color-foreground)",
                outline: "none",
              }}
              placeholder="Ex: Gostaria de um laço grande nas costas, caimento esvoaçante ou cinto fino..."
              value={s.comentario || ""}
              onChange={(e) => s.set({ comentario: e.target.value || null })}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "oklch(0.42 0.12 160 / 0.3)";
                e.currentTarget.style.boxShadow = "0 0 0 3px oklch(0.42 0.12 160 / 0.08)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "oklch(0.42 0.12 160 / 0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </Section>
        </div>
      </main>

      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <button className="btn-primary" disabled={!valid} onClick={submit}>
            ✨ Gerar croqui
          </button>
        </div>
      </div>
    </>
  );
}
