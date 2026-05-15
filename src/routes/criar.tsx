import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/criar")({
  component: Criar,
  head: () => ({ meta: [{ title: "Criar look — C&N Tecidos" }] }),
});

const OCASIOES = ["Casamento", "Festa", "Trabalho", "Casual", "Gala"];
const BIOTIPOS = ["Ampulheta", "Triângulo", "Triângulo Invertido", "Retângulo", "Oval"];
const PECAS = ["Vestido", "Saia", "Blusa", "Calça", "Macacão"];
const COMPRIMENTOS = ["Curto", "Médio", "Longo", "Midi"];
const DECOTES = ["V", "Redondo", "Canoa", "Tomara que caia", "Gola alta"];
const MANGAS = ["Sem manga", "Curta", "3/4", "Longa", "Bufante"];
const CORES = [
  { nome: "Verde C&N", hex: "#1A6B2F" },
  { nome: "Preto", hex: "#000000" },
  { nome: "Branco", hex: "#FFFFFF" },
  { nome: "Azul Marinho", hex: "#000080" },
  { nome: "Rosa", hex: "#E91E63" },
];

function Section({ title, children, hint }: { title: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-end">
        <h2 className="h2-section">{title}</h2>
        {hint && <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Criar() {
  const router = useRouter();
  const s = useLook();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const valid = s.peca && s.biotipo;

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('fotos_usuarios')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('fotos_usuarios')
        .getPublicUrl(data.path);

      s.set({ fotoUrl: publicUrl });
    } catch (err) {
      console.error("Erro ao subir foto:", err);
      alert("Erro ao subir foto. Verifique se o bucket 'fotos_usuarios' existe e é público.");
    } finally {
      setUploading(false);
    }
  };

  const submit = () => {
    if (!valid) return;
    router.navigate({ to: "/croqui" });
  };

  return (
    <>
      <Header title="Nova Criação" back="/" />
      <main className="px-5 py-6 space-y-8 pb-32 fade-in">
        <Section title="Ocasião">
          {OCASIOES.map((o) => (
            <button key={o} className="chip" data-selected={s.ocasiao === o} onClick={() => s.set({ ocasiao: o })}>
              {o}
            </button>
          ))}
        </Section>

        <Section title="Peça principal" hint="Obrigatório">
          {PECAS.map((p) => (
            <button key={p} className="chip" data-selected={s.peca === p} onClick={() => s.set({ peca: p })}>
              {p}
            </button>
          ))}
        </Section>

        <Section title="Seu biotipo" hint="Obrigatório">
          {BIOTIPOS.map((b) => (
            <button key={b} className="chip" data-selected={s.biotipo === b} onClick={() => s.set({ biotipo: b })}>
              {b}
            </button>
          ))}
        </Section>

        <Section title="Comprimento">
          {COMPRIMENTOS.map((c) => (
            <button key={c} className="chip" data-selected={s.comprimento === c} onClick={() => s.set({ comprimento: c })}>
              {c}
            </button>
          ))}
        </Section>

        <Section title="Decote">
          {DECOTES.map((d) => (
            <button key={d} className="chip" data-selected={s.decote === d} onClick={() => s.set({ decote: d })}>
              {d}
            </button>
          ))}
        </Section>

        <Section title="Manga">
          {MANGAS.map((m) => (
            <button key={m} className="chip" data-selected={s.manga === m} onClick={() => s.set({ manga: m })}>
              {m}
            </button>
          ))}
        </Section>

        <Section title="Cor ou tecido" hint="Toque para escolher">
          {CORES.map((c) => (
            <button
              key={c.nome}
              className="chip"
              data-selected={s.cor === c.nome}
              onClick={() => s.set({ cor: c.nome })}
            >
              <span
                className="inline-block w-4 h-4 rounded-full border border-border"
                style={{ background: c.hex }}
              />
              {c.nome}
            </button>
          ))}
        </Section>

        <Section title="Sua foto (opcional)" hint="Para gerar o look em você depois">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPickFile} />
          <button className="chip" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload size={14} /> {uploading ? "Enviando..." : s.fotoUrl ? "Trocar foto" : "Enviar foto"}
          </button>
          {s.fotoUrl && (
            <img src={s.fotoUrl} alt="Sua foto" className="w-16 h-16 rounded-lg object-cover border" />
          )}
        </Section>
      </main>

      <div className="fixed bottom-0 inset-x-0 px-5 py-4 bg-background/95 backdrop-blur border-t">
        <button className="btn-primary" disabled={!valid || uploading} onClick={submit}>
          ✨ Gerar croqui
        </button>
      </div>
    </>
  );
}
