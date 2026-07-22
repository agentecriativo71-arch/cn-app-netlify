import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useLook } from "@/lib/store";
import { useTutorialScreen } from "@/components/tutorial/TutorialProvider";

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

const CUSTOM_PRESETS = [
  "#800020", "#4E2A5A", "#D9007E", "#FF6F61", "#FA8072", "#FFDAB9",
  "#B76E79", "#CD7F32", "#F7E7CE", "#556B2F", "#008080", "#40E0D0",
  "#4169E1", "#87CEEB", "#4B0082", "#E6E6FA", "#36454F", "#E1AD01"
];

function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return { h: 200, s: 85, l: 50 };

  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));

  return {
    h,
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

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

  const [showPicker, setShowPicker] = useState(false);
  const [customH, setCustomH] = useState(200);
  const [customS, setCustomS] = useState(85);
  const [customL, setCustomL] = useState(50);

  const handleGenerate = () => {
    if (!s.cor) return;

    // Define implicitamente como "manequim"
    s.set({ modo: "manequim", realistaUrl: null });
    router.navigate({ to: "/resultado" });
  };

  const isValid = !!s.cor;
  const isCustomSelected = s.cor && !CORES.some(c => c.nome === s.cor || c.hex === s.cor);
  useTutorialScreen("realista");

  const openCustomPicker = () => {
    if (isCustomSelected && s.cor?.startsWith("#")) {
      const hsl = hexToHsl(s.cor);
      setCustomH(hsl.h);
      setCustomS(hsl.s);
      setCustomL(hsl.l);
    } else {
      setCustomH(200);
      setCustomS(85);
      setCustomL(50);
    }
    setShowPicker(true);
  };

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
          <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start" data-tutorial="color-grid">
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
              return (
                <button
                  type="button"
                  className="color-swatch relative cursor-pointer flex items-center justify-center"
                  data-selected={isCustomSelected || undefined}
                  style={{
                    background: isCustomSelected ? s.cor! : "conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)",
                  }}
                  title="Cor personalizada"
                  onClick={openCustomPicker}
                >
                  {!isCustomSelected && (
                    <span className="text-[20px] font-bold text-white drop-shadow-md select-none">+</span>
                  )}
                </button>
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
            data-tutorial="generate-button"
          >
            ✨ Gerar foto realista
          </button>
        </div>
      </div>

      {/* Custom Color Picker Modal */}
      {showPicker && (
        <div className="picker-modal-overlay" onClick={() => setShowPicker(false)}>
          <div className="picker-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold text-[#E6DEC9] font-display flex items-center gap-2">
                🎨 Cor Personalizada
              </h3>
              <button onClick={() => setShowPicker(false)} className="text-white/50 hover:text-white text-xl">
                &times;
              </button>
            </div>

            <div className="space-y-4">
              {/* Preview Circle */}
              <div className="flex flex-col items-center gap-2 py-2">
                <div 
                  className="w-20 h-20 rounded-full border-4 border-white/20 shadow-inner"
                  style={{ background: hslToHex(customH, customS, customL) }}
                />
                <span className="text-xs font-mono tracking-wider text-white/70">
                  {hslToHex(customH, customS, customL)}
                </span>
              </div>

              {/* Grid of Preset Touch-friendly Colors */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Paleta de Apoio</p>
                <div className="picker-grid">
                  {CUSTOM_PRESETS.map((hex) => {
                    const activeHex = hslToHex(customH, customS, customL);
                    const isSelected = activeHex === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        className="picker-swatch"
                        style={{ background: hex }}
                        data-selected={isSelected || undefined}
                        onClick={() => {
                          const hsl = hexToHsl(hex);
                          setCustomH(hsl.h);
                          setCustomS(hsl.s);
                          setCustomL(hsl.l);
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-3 pt-2">
                {/* Hue */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-white/70">
                    <span>Matiz (Tom)</span>
                    <span>{customH}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={customH}
                    onChange={(e) => setCustomH(Number(e.target.value))}
                    className="picker-range"
                    style={{
                      background: "linear-gradient(to right, red, #ff0, #0f0, #0ff, #00f, #f0f, red)"
                    }}
                  />
                </div>

                {/* Saturation */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-white/70">
                    <span>Saturação (Intensidade)</span>
                    <span>{customS}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={customS}
                    onChange={(e) => setCustomS(Number(e.target.value))}
                    className="picker-range"
                    style={{
                      background: `linear-gradient(to right, hsl(${customH}, 0%, ${customL}%), hsl(${customH}, 100%, ${customL}%))`
                    }}
                  />
                </div>

                {/* Lightness */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-white/70">
                    <span>Luminosidade (Brilho)</span>
                    <span>{customL}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="90"
                    value={customL}
                    onChange={(e) => setCustomL(Number(e.target.value))}
                    className="picker-range"
                    style={{
                      background: `linear-gradient(to right, #000000, hsl(${customH}, ${customS}%, 50%), #ffffff)`
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="btn-secondary py-2.5 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  s.set({ cor: hslToHex(customH, customS, customL) });
                  setShowPicker(false);
                }}
                className="btn-primary py-2.5 rounded-xl text-sm w-full font-bold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
