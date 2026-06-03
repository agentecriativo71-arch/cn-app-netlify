import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useState, useRef } from "react";
import { User, Camera, Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";

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
        <h2 className="h2-section">{title}</h2>
        {hint && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Realista() {
  const router = useRouter();
  const s = useLook();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [selectedModo, setSelectedModo] = useState<"manequim" | "foto" | null>(s.modo);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from("fotos_usuarios")
        .upload(fileName, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage
        .from("fotos_usuarios")
        .getPublicUrl(data.path);
      s.set({ fotoUrl: publicUrl });
    } catch (err) {
      console.error("Erro ao subir foto:", err);
      alert("Erro ao subir foto. Verifique se o bucket 'fotos_usuarios' existe e é público.");
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = () => {
    if (!s.cor || !selectedModo) return;
    if (selectedModo === "foto" && !s.fotoUrl) return;

    s.set({ modo: selectedModo, realistaUrl: null });
    router.navigate({ to: "/resultado" });
  };

  const isValid = s.cor && selectedModo && (selectedModo !== "foto" || s.fotoUrl);

  return (
    <>
      <Header title="Configurar foto realista" back="/croqui" />
      <main className="px-5 py-6 space-y-8 pb-32 fade-in">
        <p className="text-[15px] text-muted-foreground text-center">
          Configure as opções para gerar a visualização realista da sua peça.
        </p>

        {/* Seção 1: Cor ou Tecido */}
        <Section title="Cor ou tecido" hint="Obrigatório">
          <div className="flex flex-wrap gap-3 items-center">
            {CORES.map(c => {
              const isSelected = s.cor === c.nome || s.cor === c.hex;
              return (
                <button
                  key={c.nome}
                  onClick={() => s.set({ cor: c.nome })}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: c.hex,
                    boxShadow: isSelected ? "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary)" : "none",
                    transform: isSelected ? "scale(1.1)" : "scale(1)",
                  }}
                  title={c.nome}
                />
              );
            })}

            {/* Custom Color Selector */}
            {(() => {
              const isCustomSelected = s.cor && !CORES.some(c => c.nome === s.cor || c.hex === s.cor);
              return (
                <label
                  className="relative w-10 h-10 rounded-full border border-border cursor-pointer flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95"
                  style={{
                    background: isCustomSelected ? s.cor! : "conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)",
                    boxShadow: isCustomSelected ? "0 0 0 2px var(--color-background), 0 0 0 4px var(--color-primary)" : "none",
                    transform: isCustomSelected ? "scale(1.1)" : "scale(1)",
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
            <p className="text-xs text-muted-foreground mt-2 font-medium">
              Cor selecionada: <span className="font-semibold text-foreground">{s.cor}</span>
            </p>
          )}
        </Section>

        {/* Seção 2: Modelo de Visualização */}
        <Section title="Como quer ver?" hint="Obrigatório">
          <div className="space-y-4">
            <button
              onClick={() => setSelectedModo("manequim")}
              className="w-full card-soft text-left flex items-center gap-4 hover:bg-surface/30 transition border"
              style={{
                borderColor: selectedModo === "manequim" ? "var(--color-primary)" : "transparent",
              }}
            >
              <div className="w-14 h-14 rounded-xl bg-surface flex items-center justify-center text-primary">
                <User size={28} />
              </div>
              <div>
                <p className="font-semibold text-foreground">No manequim</p>
                <p className="text-xs text-muted-foreground mt-0.5">Veja como a peça fica em um modelo 3D realista</p>
              </div>
            </button>

            <button
              onClick={() => setSelectedModo("foto")}
              className="w-full card-soft text-left flex items-center gap-4 hover:bg-surface/30 transition border"
              style={{
                borderColor: selectedModo === "foto" ? "var(--color-primary)" : "transparent",
              }}
            >
              <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-primary">
                <Camera size={28} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Na minha foto</p>
                <p className="text-xs text-muted-foreground mt-0.5">Vista a peça digitalmente em sua própria foto</p>
              </div>
            </button>
          </div>
        </Section>

        {/* Seção 3: Upload de Foto (Se selecionou Foto) */}
        {selectedModo === "foto" && (
          <Section title="Sua foto" hint="Obrigatório">
            <div className="card-soft bg-muted flex flex-col items-center gap-4 p-5">
              <p className="text-xs text-muted-foreground text-center max-w-[280px]">
                Envie uma foto de corpo inteiro, de frente, com boa iluminação e roupas justas para melhor resultado.
              </p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
              <button
                className="btn-secondary w-full max-w-[200px]"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                <Upload size={16} /> {uploading ? "Enviando..." : s.fotoUrl ? "Trocar foto" : "Enviar foto"}
              </button>
              {s.fotoUrl && (
                <div className="relative mt-2 border rounded-xl overflow-hidden aspect-[3/4] w-32 shadow-sm">
                  <img src={s.fotoUrl} alt="Sua foto" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </Section>
        )}
      </main>

      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-background/95 backdrop-blur border-t">
        <button
          className="btn-primary w-full"
          disabled={!isValid || uploading}
          onClick={handleGenerate}
        >
          ✨ Gerar foto realista
        </button>
      </div>
    </>
  );
}
