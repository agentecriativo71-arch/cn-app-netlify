import { useState, useEffect } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { useLook } from "@/lib/store";
import { searchProductsFn } from "@/server/api";
import { Search, X, Layers, AlertCircle, Check } from "lucide-react";
import { getAvailableColors } from "@/lib/noivaUtils";

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

type ProductResult = {
  id: number;
  name: string;
  sku: string;
  image_url: string | null;
  pantone: string | null;
  tag: string | null;
};

function Realista() {
  const router = useRouter();
  const s = useLook();

  const [showPicker, setShowPicker] = useState(false);
  const [customH, setCustomH] = useState(200);
  const [customS, setCustomS] = useState(85);
  const [customL, setCustomL] = useState(50);

  // Estados de busca por SKU / Produto
  const [skuQuery, setSkuQuery] = useState("");
  const [suggestions, setSuggestions] = useState<ProductResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [noImageWarning, setNoImageWarning] = useState(false);

  useEffect(() => {
    if (!skuQuery.trim() || skuQuery.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchProductsFn({ data: { term: skuQuery } });
        setSuggestions(res.results || []);
        setShowDropdown(true);
      } catch (err) {
        console.error("[SKU SEARCH] Error:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [skuQuery]);

  const handleSelectProduct = (prod: ProductResult) => {
    setShowDropdown(false);
    setSkuQuery("");

    if (prod.image_url) {
      setNoImageWarning(false);
      s.set({
        tecidoSku: prod.sku,
        tecidoNome: prod.name,
        tecidoImageUrl: prod.image_url,
        tecidoPantone: prod.pantone,
        cor: null, // Limpa seleção de cor pois usará a foto do tecido
      });
    } else {
      setNoImageWarning(true);
      s.set({
        tecidoSku: prod.sku,
        tecidoNome: prod.name,
        tecidoImageUrl: null,
        tecidoPantone: prod.pantone,
      });
    }
  };

  const handleRemoveTecido = () => {
    s.set({
      tecidoSku: null,
      tecidoNome: null,
      tecidoImageUrl: null,
      tecidoPantone: null,
    });
    setNoImageWarning(false);
  };

  const handleGenerate = () => {
    if (!s.cor && !s.tecidoImageUrl && !s.tecidoSku) return;

    // Define implicitamente como "manequim"
    s.set({ modo: "manequim", realistaUrl: null });
    router.navigate({ to: "/resultado" });
  };

  const coresDisponiveis = getAvailableColors(s.ocasiao);
  const isValid = !!s.cor || !!s.tecidoImageUrl || !!s.tecidoSku;
  const isCustomSelected = s.cor && !coresDisponiveis.some(c => c.nome === s.cor || c.hex === s.cor);

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

  const hasTecidoWithImage = !!s.tecidoImageUrl;

  return (
    <>
      <Header title="Configurar foto realista" back="/croqui" />
      <Stepper current="realista" />
      <main className="container-app px-5 py-6 space-y-8 pb-32 fade-in">
        <p className="text-[15px] text-center" style={{ color: "var(--color-muted-foreground)" }}>
          Selecione o tecido pelo SKU do estoque ou escolha uma cor para gerar a visualização realista da sua peça.
        </p>

        {/* Seção 1: Selecionar Tecido por SKU */}
        <div className="space-y-3">
          <div className="flex justify-between items-end">
            <h2 className="h2-section">
              <span style={{ fontSize: "14px" }}>🧵</span>
              Tecido do Estoque (SKU)
            </h2>
            <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--color-muted-foreground)" }}>Opcional</span>
          </div>

          {!s.tecidoSku ? (
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                style={{
                  border: "1.5px solid rgba(255, 255, 255, 0.2)",
                  background: "rgba(255, 255, 255, 0.08)",
                }}
              >
                <Search size={16} className="text-white/50" />
                <input
                  type="text"
                  placeholder="Digite o SKU ou nome do tecido..."
                  value={skuQuery}
                  onChange={(e) => setSkuQuery(e.target.value)}
                  onFocus={() => skuQuery.trim().length >= 2 && setShowDropdown(true)}
                  className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
                />
                {skuQuery && (
                  <button onClick={() => { setSkuQuery(""); setSuggestions([]); setShowDropdown(false); }}>
                    <X size={16} className="text-white/50 hover:text-white" />
                  </button>
                )}
              </div>

              {/* Dropdown de sugestões */}
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-2 z-50 rounded-xl overflow-hidden shadow-2xl border border-white/20 backdrop-blur-xl bg-[#1A1A1A]/95 max-h-60 overflow-y-auto divide-y divide-white/10">
                  {searching ? (
                    <div className="p-3 text-xs text-center text-white/50">Buscando no estoque...</div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-3 text-xs text-center text-white/50">Nenhum tecido encontrado com esse SKU ou nome.</div>
                  ) : (
                    suggestions.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="w-full p-3 flex items-center gap-3 text-left hover:bg-white/10 transition-colors"
                      >
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-white/20" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center border border-white/10">
                            <Layers size={18} className="text-white/40" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white truncate">{p.name}</p>
                          <p className="text-[10px] font-mono text-[#E5D3A2]">SKU: {p.sku}</p>
                        </div>
                        {p.image_url ? (
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Com Foto</span>
                        ) : (
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-white/40">Sem Foto</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Card do Tecido Selecionado */
            <div className="p-4 rounded-xl border border-[#E5D3A2]/40 bg-white/10 space-y-3 fade-in">
              <div className="flex items-center gap-4">
                {s.tecidoImageUrl ? (
                  <img src={s.tecidoImageUrl} alt={s.tecidoNome!} className="w-16 h-16 rounded-xl object-cover border-2 border-[#E5D3A2]/60 shadow-md" />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-white/10 flex flex-col items-center justify-center border border-white/20">
                    <Layers size={22} className="text-white/40" />
                    <span className="text-[9px] text-white/40 mt-1">Sem foto</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-[#E5D3A2]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5D3A2]">Tecido Selecionado</span>
                  </div>
                  <h3 className="text-sm font-extrabold text-white truncate">{s.tecidoNome}</h3>
                  <p className="text-xs font-mono text-white/70">SKU: {s.tecidoSku}</p>
                </div>
                <button
                  onClick={handleRemoveTecido}
                  className="p-2 rounded-lg bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-white/60 transition-all"
                  title="Remover tecido"
                >
                  <X size={18} />
                </button>
              </div>

              {noImageWarning && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs">
                  <AlertCircle size={16} className="shrink-0" />
                  <span>Este tecido não possui foto cadastrada no estoque. Por favor, selecione uma cor abaixo.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seção 2: Selecionar Cor (Oculta se houver tecido com imagem selecionado) */}
        {!hasTecidoWithImage ? (
          <Section title="Cor" hint={s.tecidoSku ? "Necessária (tecido sem foto)" : "Obrigatório"}>
            <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start">
              {coresDisponiveis.map(c => {
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
              {s.ocasiao !== "Noiva" && (
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
              )}
            </div>
            {s.cor && (
              <p className="text-xs mt-2 font-medium" style={{ color: "var(--color-muted-foreground)" }}>
                Cor selecionada: <span className="font-semibold" style={{ color: "var(--color-foreground)" }}>{s.cor}</span>
              </p>
            )}
          </Section>
        ) : (
          <div className="p-3.5 rounded-xl border border-white/10 bg-white/5 text-center text-xs text-white/60">
            💡 A foto realista será gerada aplicando a foto real do tecido <span className="text-[#E5D3A2] font-semibold">{s.tecidoNome}</span> no seu croqui.
          </div>
        )}
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
