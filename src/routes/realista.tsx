import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useLook } from "@/lib/store";

export const Route = createFileRoute("/realista")({
  component: Realista,
  head: () => ({ meta: [{ title: "Foto realista — C&N Tecidos" }] }),
});

const CORES = [
  { nome: "Verde C&N", hex: "#1A6B2F" },
  { nome: "Preto", hex: "#000000" },
  { nome: "Branco", hex: "#FFFFFF" },
  { nome: "Azul Marinho", hex: "#1E3A8A" },
  { nome: "Vermelho Rubi", hex: "#BE123C" },
  { nome: "Rosa Pastel", hex: "#FBCFE8" },
  { nome: "Roxo Imperial", hex: "#6D28D9" },
  { nome: "Terracota", hex: "#C2410C" },
  { nome: "Amarelo Mostarda", hex: "#D97706" },
  { nome: "Nude/Bege", hex: "#F5F5DC" },
  { nome: "Lilás", hex: "#C084FC" },
  { nome: "Verde Menta", hex: "#A7F3D0" }
];

function Section({ title, children, hint }: {
  title: string; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <h2 className="h2-section">
          <span style={{ fontSize: "14px" }}>🎨</span>
          {title}
        </h2>
        {hint && <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Realista() {
  const router = useRouter();
  const s = useLook();

  const handleGenerate = () => {
    if (!s.cor) return;

    // Define implicitamente como "manequim"
    s.set({ modo: "manequim", realistaUrl: null });
    router.navigate({ to: "/resultado" });
  };

  const isValid = !!s.cor;

  return (
    <>
      <Header title="Configurar foto realista" back="/croqui" />
      <Stepper current="realista" />
      <main className="container-app px-5 py-6 space-y-8 pb-32 fade-in">
        <p className="text-[15px] text-center" style={{ color: "var(--color-muted-foreground)" }}>
          Selecione a cor ou tecido para gerar a visualização realista da sua peça em um manequim virtual.
        </p>

        {/* Seção 1: Cor ou Tecido */}
        <Section title="Cor ou tecido" hint="Obrigatório">
          <div className="flex flex-wrap gap-3 items-center">
            {CORES.map(c => {
              const isSelected = s.cor === c.nome || s.cor === c.hex;
              return (
                <div key={c.nome} className="relative group">
                  <button
                    onClick={() => s.set({ cor: c.nome })}
                    className="color-swatch"
                    data-selected={isSelected}
                    style={{ background: c.hex }}
                    title={c.nome}
                  />
                  {/* Tooltip */}
                  <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 rounded-md"
                    style={{ background: "oklch(0.18 0.01 145)", color: "white" }}
                  >
                    {c.nome}
                  </span>
                </div>
              );
            })}

            {/* Custom Color Selector */}
            {(() => {
              const isCustomSelected = s.cor && !CORES.some(c => c.nome === s.cor || c.hex === s.cor);
              return (
                <label
                  className="color-swatch relative cursor-pointer"
                  data-selected={isCustomSelected || undefined}
                  style={{
                    background: isCustomSelected ? s.cor! : "conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)",
                  }}
                  title="Cor personalizada"
                >
                  <input
                    type="color"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    value={isCustomSelected ? s.cor! : "#ffffff"}
                    onChange={(e) => s.set({ cor: e.target.value })}
                  />
                  {!isCustomSelected && (
                    <span className="text-[16px] font-bold text-white drop-shadow-md select-none">+</span>
                  )}
                </label>
              );
            })()}
          </div>
          {s.cor && (
            <p className="text-xs mt-2 font-medium" style={{ color: "var(--color-muted-foreground)" }}>
              Cor selecionada: <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>{s.cor}</span>
            </p>
          )}
        </Section>
      </main>

      <div className="bottom-bar">
        <div className="bottom-bar-inner">
          <button
            className="btn-primary w-full"
            disabled={!isValid}
            onClick={handleGenerate}
          >
            ✨ Gerar foto realista
          </button>
        </div>
      </div>
    </>
  );
}
