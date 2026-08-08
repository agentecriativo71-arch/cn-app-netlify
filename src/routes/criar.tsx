import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useLook, LookState } from "@/lib/store";
import { ImageOff, Check, PartyPopper, Shirt, Ruler, MessageSquare } from "lucide-react";
import elementosData from "@/lib/elementos_vestuario.json";
import { useEffect, useState } from "react";
import { useVideoStore } from "@/lib/videoStore";

import ocasiaoCasamento from "@/assets/ocasiao-casamento.png";
import ocasiaoFesta from "@/assets/ocasiao-festa.png";
import ocasiaoTrabalho from "@/assets/ocasiao-trabalho.png";
import ocasiaoCasual from "@/assets/ocasiao-casual.png";

const OCASIOES_ITEMS = [
  { id: "noiva", nome: "Noiva", image_url: ocasiaoCasamento },
  { id: "festa", nome: "Festa", image_url: ocasiaoFesta },
  { id: "casual", nome: "Casual", image_url: ocasiaoCasual },
  { id: "fardamento", nome: "Fardamento", image_url: ocasiaoTrabalho },
];

import pecaVestido from "@/assets/peca-vestido.png";
import pecaSaia from "@/assets/peca-saia.png";
import pecaBlusa from "@/assets/peca-blusa.png";
import pecaCalca from "@/assets/peca-calca.png";
import pecaMacacao from "@/assets/peca-macacao.png";
import pecaTop from "@/assets/peca-top.png";
import pecaShortBermuda from "@/assets/peca-short-bermuda.png";
import pecaBlazer from "@/assets/peca-blazer.png";

const PECAS_POR_CATEGORIA: Record<string, any[]> = {
  "Noiva": [],
  "Festa": [
    { id: "vestido", nome: "Vestido", image_url: pecaVestido },
    { id: "saia", nome: "Saia", image_url: pecaSaia },
    { id: "blusa", nome: "Blusa", image_url: pecaBlusa },
    { id: "calca", nome: "Calça", image_url: pecaCalca },
    { id: "macacao", nome: "Macacão", image_url: pecaMacacao },
  ],
  "Casual": [
    { id: "vestido", nome: "Vestido", image_url: pecaVestido },
    { id: "top", nome: "Top", image_url: pecaTop },
    { id: "blusa", nome: "Blusa", image_url: pecaBlusa },
    { id: "macacao", nome: "Macacão", image_url: pecaMacacao },
    { id: "calca", nome: "Calça", image_url: pecaCalca },
    { id: "short_bermuda", nome: "Short/Bermuda", image_url: pecaShortBermuda },
  ],
  "Fardamento": [
    { id: "calca", nome: "Calça", image_url: pecaCalca },
    { id: "blusa", nome: "Blusa", image_url: pecaBlusa },
    { id: "blazer", nome: "Blazer", image_url: pecaBlazer },
    { id: "saia", nome: "Saia", image_url: pecaSaia },
    { id: "vestido", nome: "Vestido", image_url: pecaVestido },
  ],
};

import biotipoAmpulheta from "@/assets/biotipo-ampulheta.png";
import biotipoTriangulo from "@/assets/biotipo-triangulo.png";
import biotipoTrianguloInvertido from "@/assets/biotipo-triangulo-invertido.png";
import biotipoRetangulo from "@/assets/biotipo-retangulo.png";

const BIOTIPOS_ITEMS = [
  { id: "ampulheta", nome: "Ampulheta", image_url: biotipoAmpulheta },
  { id: "triangulo", nome: "Triângulo", image_url: biotipoTriangulo },
  { id: "triangulo_invertido", nome: "Triângulo Invertido", image_url: biotipoTrianguloInvertido },
  { id: "retangulo", nome: "Retângulo", image_url: biotipoRetangulo },
];

export const Route = createFileRoute("/criar")({
  component: Criar,
  head: () => ({ meta: [{ title: "Criar look — C&N Tecidos" }] }),
});

const OCASIOES = ["Noiva", "Festa", "Casual", "Fardamento"];
const BIOTIPOS = ["Ampulheta", "Triângulo", "Triângulo Invertido", "Retângulo"];
const COMPRIMENTOS = ["Curto", "Médio", "Longo", "Midi"];
const TIPOS_CERIMONIA = ["Civil", "Igreja", "Cerimônia Aberta"];
const DECISAO_RENDA = ["Sim", "Não"];

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
function ElementGrid({ items, selected, onSelect, className }: {
  items: { id: number | string; nome: string; image_url?: string | null }[];
  selected: string | null;
  onSelect: (nome: string) => void;
  className?: string;
}) {
  return (
    <div className={`element-grid ${className || ""}`}>
      {items.map(el => {
        const isSelected = selected === el.nome;
        return (
          <div
            key={el.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(isSelected ? "" : el.nome)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(isSelected ? "" : el.nome);
              }
            }}
            className="card-element border border-white/15 shadow-2xl"
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
          </div>
        );
      })}
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────

function Criar() {
  const router = useRouter();
  const s = useLook();
  const { triggerTransition, transitionPhase } = useVideoStore();
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!s.nome) {
      router.navigate({ to: "/" });
    }
  }, [s.nome, router]);

  const isNoiva = s.ocasiao === "Noiva";
  const valid = s.nome && s.ocasiao && (isNoiva ? (s.tipoCerimonia && s.rendaDecisao !== null && s.comprimento && s.biotipo) : (s.peca && s.biotipo));

  // Condicionais de exibição baseadas na peça principal selecionada
  const pecaAtual = isNoiva ? "Vestido" : s.peca;
  const showComprimento = pecaAtual === "Vestido" || pecaAtual === "Saia";
  const showDecote = !isNoiva && (pecaAtual === "Vestido" || pecaAtual === "Blusa" || pecaAtual === "Macacão" || pecaAtual === "Top");
  const isSleevelessDecote = s.decote === "Frente Única" || s.decote === "Coração (Sweetheart)" || s.decote === "Tomara que Caia";
  const showManga = !isNoiva && (pecaAtual === "Vestido" || pecaAtual === "Blusa" || pecaAtual === "Macacão" || pecaAtual === "Top") && !isSleevelessDecote;
  const showSaia = !isNoiva && (pecaAtual === "Vestido" || pecaAtual === "Saia");
  const showRenda = !isNoiva && RENDAS.length > 0 && (pecaAtual === "Vestido" || pecaAtual === "Saia" || pecaAtual === "Blusa" || pecaAtual === "Top");

  // Definindo as etapas ativas dinamicamente
  const steps: any[] = [];

  steps.push({
    id: "ocasiao",
    title: "Escolha a Ocasião",
    hint: "Obrigatório",
    valid: !!s.ocasiao,
    render: () => (
      <ElementGrid
        className="grid-2x2"
        items={OCASIOES_ITEMS}
        selected={s.ocasiao}
        onSelect={(nome) => {
          s.set({ 
            ocasiao: nome || null, 
            peca: nome === "Noiva" ? "Vestido" : null,
            tipoCerimonia: null,
            rendaDecisao: null,
            comprimento: null,
            decote: null,
            manga: null,
            saia: null,
            renda: null,
            biotipo: null
          });
        }}
      />
    )
  });

  if (isNoiva) {
    steps.push({
      id: "tipoCerimonia",
      title: "Tipo de Cerimônia",
      hint: "Obrigatório",
      valid: !!s.tipoCerimonia,
      render: () => (
        <div className="flex justify-center flex-wrap gap-2.5 max-w-md mx-auto">
          <ChipRow items={TIPOS_CERIMONIA} selected={s.tipoCerimonia} onSelect={(v) => s.set({ tipoCerimonia: v })} />
        </div>
      )
    });
    steps.push({
      id: "rendaDecisao",
      title: "O vestido terá renda?",
      hint: "Obrigatório",
      valid: s.rendaDecisao !== null,
      render: () => (
        <div className="flex justify-center flex-wrap gap-2.5 max-w-md mx-auto">
          <ChipRow 
            items={DECISAO_RENDA} 
            selected={s.rendaDecisao === null ? null : (s.rendaDecisao ? "Sim" : "Não")} 
            onSelect={(v) => {
              const isSim = v === "Sim";
              s.set({ rendaDecisao: isSim, ...(isSim ? {} : { renda: null }) });
            }} 
          />
        </div>
      )
    });
    if (s.rendaDecisao === true && RENDAS.length > 0) {
      steps.push({
        id: "renda",
        title: "Tipo de Renda",
        hint: "Escolha a renda desejada",
        valid: true,
        render: () => (
          <ElementGrid
            items={RENDAS}
            selected={s.renda}
            onSelect={(nome) => s.set({ renda: nome || null })}
          />
        )
      });
    }
    steps.push({
      id: "comprimento",
      title: "Comprimento do Vestido",
      hint: "Obrigatório",
      valid: !!s.comprimento,
      render: () => (
        <div className="flex justify-center flex-wrap gap-2.5 max-w-md mx-auto">
          <ChipRow items={COMPRIMENTOS} selected={s.comprimento} onSelect={(v) => s.set({ comprimento: v })} />
        </div>
      )
    });
    steps.push({
      id: "biotipo",
      title: "Seu Biotipo",
      hint: "Obrigatório",
      valid: !!s.biotipo,
      render: () => (
        <ElementGrid
          className="grid-2x2"
          items={BIOTIPOS_ITEMS}
          selected={s.biotipo}
          onSelect={(nome) => s.set({ biotipo: nome || null })}
        />
      )
    });
  } else {
    // Festa, Casual, Fardamento
    if (s.ocasiao) {
      steps.push({
        id: "peca",
        title: "Peça Principal",
        hint: "Obrigatório",
        valid: !!s.peca,
        render: () => (
          <ElementGrid
            items={PECAS_POR_CATEGORIA[s.ocasiao!]}
            selected={s.peca}
            onSelect={(nome) => {
              const v = nome || null;
              const patch: Partial<LookState> = { peca: v };
              if (v === "Saia") {
                patch.decote = null;
                patch.manga = null;
              } else if (v === "Blazer") {
                patch.saia = null;
                patch.comprimento = null;
                patch.manga = "Longa";
              } else if (v === "Blusa" || v === "Macacão" || v === "Top") {
                patch.saia = null;
                patch.comprimento = null;
              } else if (v === "Calça" || v === "Short/Bermuda") {
                patch.decote = null;
                patch.manga = null;
                patch.saia = null;
                patch.comprimento = null;
              }
              s.set(patch);
            }}
          />
        )
      });
      
      if (showComprimento) {
        steps.push({
          id: "comprimento",
          title: "Escolha o Comprimento",
          hint: "Opcional",
          valid: true,
          render: () => (
            <div className="flex justify-center flex-wrap gap-2.5 max-w-md mx-auto">
              <ChipRow items={COMPRIMENTOS} selected={s.comprimento} onSelect={(v) => s.set({ comprimento: v })} />
            </div>
          )
        });
      }
      
      if (showDecote && DECOTES.length > 0) {
        steps.push({
          id: "decote",
          title: "Escolha seu Decote",
          hint: "Toque para escolher",
          valid: true,
          render: () => (
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
          )
        });
      }
      
      if (showManga && MANGAS.length > 0) {
        steps.push({
          id: "manga",
          title: "Escolha a Manga",
          hint: "Toque para escolher",
          valid: true,
          render: () => (
            <ElementGrid
              items={MANGAS}
              selected={s.manga}
              onSelect={(nome) => s.set({ manga: nome || null })}
            />
          )
        });
      }
      
      if (showSaia && SAIAS.length > 0) {
        steps.push({
          id: "saia",
          title: "Modelo de Saia",
          hint: "Toque para escolher",
          valid: true,
          render: () => (
            <ElementGrid
              items={SAIAS}
              selected={s.saia}
              onSelect={(nome) => s.set({ saia: nome || null })}
            />
          )
        });
      }
      
      if (showRenda && RENDAS.length > 0) {
        steps.push({
          id: "renda",
          title: "Detalhes em Renda",
          hint: "Opcional",
          valid: true,
          render: () => (
            <ElementGrid
              items={RENDAS}
              selected={s.renda}
              onSelect={(nome) => s.set({ renda: nome || null })}
            />
          )
        });
      }
      
      steps.push({
        id: "biotipo",
        title: "Seu Biotipo",
        hint: "Obrigatório",
        valid: !!s.biotipo,
        render: () => (
          <ElementGrid
            className="grid-2x2"
            items={BIOTIPOS_ITEMS}
            selected={s.biotipo}
            onSelect={(nome) => s.set({ biotipo: nome || null })}
          />
        )
      });
    }
  }

  steps.push({
    id: "comentario",
    title: "Detalhes Extras",
    hint: "Opcional",
    valid: true,
    render: () => (
      <div className="w-full max-w-md mx-auto">
        <textarea
          className="w-full min-h-[120px] p-4 rounded-xl text-[14px] leading-relaxed resize-none transition-all"
          style={{
            border: "1.5px solid rgba(255, 255, 255, 0.2)",
            background: "rgba(255, 255, 255, 0.08)",
            color: "white",
            outline: "none",
          }}
          placeholder="Ex: Gostaria de um laço grande nas costas, caimento esvoaçante ou cinto fino..."
          value={s.comentario || ""}
          onChange={(e) => s.set({ comentario: e.target.value || null })}
        />
      </div>
    )
  });

  // Garantir que o index esteja dentro dos limites atuais das etapas dinâmicas
  const currentStepIndex = Math.min(stepIndex, steps.length - 1);
  const currentStep = steps[currentStepIndex];
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleAdvance = () => {
    const nextIndex = currentStepIndex + 1;
    const nextStep = steps[nextIndex];
    if (nextStep && currentStep) {
      import("@/lib/transitionMessages").then(({ getTransitionMessage }) => {
        const msg = getTransitionMessage(currentStep.id, nextStep.id, {
          nome: s.nome,
          ocasiao: s.ocasiao,
          peca: s.peca,
          biotipo: s.biotipo,
        });
        
        // Transição rápida entre etapas: total 2s, fade-in da nova tela em 0.9s.
        // A mensagem permanece visível por mais 1.8s sobre a nova tela, dando
        // tempo de leitura sem atrasar a navegação em si.
        triggerTransition(() => {
          setStepIndex(nextIndex);
        }, 2000, 900, msg, 1800);
      });
    } else {
      setStepIndex(nextIndex);
    }
  };

  const submit = () => {
    if (!valid) return;
    import("@/lib/transitionMessages").then(({ getTransitionMessage }) => {
      const msg = getTransitionMessage(steps[currentStepIndex].id, "croqui", {
        nome: s.nome,
        ocasiao: s.ocasiao,
        peca: s.peca,
        biotipo: s.biotipo,
      });

      s.set({ croquiUrl: null, realistaUrl: null, dbId: null });
      // Transição rápida para o croqui: total 2s, fade-in em 0.9s, mensagem
      // com 1.8s extra de leitura sobre a tela de loading do croqui.
      triggerTransition(() => {
        router.navigate({ to: "/croqui" });
      }, 2000, 900, msg, 1800);
    });
  };

  const isExiting = transitionPhase === "exit";

  return (
    <>
      <Header title="Nova Criação" back="/" />
      <Stepper current="criar" />
      <main
        className="container-app px-5 py-8 pb-36 flex flex-col justify-center flex-1"
        style={{
          opacity: isExiting ? 0 : undefined,
          transform: isExiting ? "translateY(-16px) scale(0.97)" : "none",
          transition: "opacity 3s ease-in-out, transform 3s ease-in-out",
        }}
      >
        <div className="space-y-6">
          {s.nome && currentStepIndex === 0 && (
            <p className="text-[16px] font-medium text-center leading-relaxed text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              Olá, <span className="text-[20px] font-extrabold text-[#E5D3A2]">{s.nome}</span>! Vamos criar o seu look perfeito.
            </p>
          )}

          <div className="flex flex-col items-center justify-center text-center my-4 gap-4 fade-in">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#E6DEC9] tracking-tight uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]" style={{ fontFamily: "var(--font-display)" }}>
              {currentStep.title}
            </h2>
            {currentStep.hint && (
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-[#E5D3A2]/90 font-bold drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {currentStep.hint}
              </p>
            )}
            
            {/* Step indicator */}
            <p className="text-[11px] uppercase tracking-wider text-white/80 font-medium drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
              Etapa {currentStepIndex + 1} de {steps.length}
            </p>

            <div className="w-full mt-6">
              {currentStep.render()}
            </div>
          </div>
        </div>
      </main>

      <div className="bottom-bar">
        <div className="bottom-bar-inner flex gap-3 items-center">
          <button 
            onClick={() => {
              if (currentStepIndex > 0) {
                setStepIndex(currentStepIndex - 1);
              } else {
                router.navigate({ to: "/" });
              }
            }} 
            className="btn-secondary flex-1"
          >
            Voltar
          </button>
          
          <div className="flex-1">
            {isLastStep ? (
              <div className="btn-double-border-container">
                <button 
                  className="btn-double-border" 
                  disabled={!valid} 
                  onClick={submit}
                >
                  Gerar croqui
                </button>
              </div>
            ) : (
              <button 
                className="btn-primary" 
                disabled={!currentStep.valid} 
                onClick={handleAdvance}
              >
                Avançar
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
