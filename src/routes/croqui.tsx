import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";

import { generateCroquiFn, saveLookDbFn } from "@/server/api";

export const Route = createFileRoute("/croqui")({
  component: Croqui,
  head: () => ({ meta: [{ title: "Seu croqui — C&N Tecidos" }] }),
});

const MSGS = [
  "Desenhando seu croqui...",
  "Camila está dando vida à sua ideia ✨",
  "Quase lá!",
];

function Croqui() {
  const router = useRouter();
  const s = useLook();
  const [loading, setLoading] = useState(!s.croquiUrl);
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const i = setInterval(() => setMsg((m) => (m + 1) % MSGS.length), 1500);
    
    async function doGeneration() {
      try {
        const res = await generateCroquiFn({
          data: {
            peca: s.peca,
            biotipo: s.biotipo,
            comprimento: s.comprimento,
            decote: s.decote,
            manga: s.manga
          }
        });
        
        s.set({ croquiUrl: res.url });
        
        const dbRes = await saveLookDbFn({
          data: {
            ocasiao: s.ocasiao,
            biotipo: s.biotipo,
            peca: s.peca,
            comprimento: s.comprimento,
            decote: s.decote,
            manga: s.manga,
            cor: s.cor,
            croqui_url: res.url,
            foto_usuario_url: s.fotoUrl
          }
        });
        
        s.set({ dbId: dbRes.id }); 
      } catch (err) {
        console.error(err);
        alert("Erro ao gerar croqui. Tente novamente.");
        router.history.back();
      } finally {
        setLoading(false);
      }
    }
    
    doGeneration();
    return () => clearInterval(i);
  }, [loading]);

  if (loading) {
    return (
      <>
        <Header title="Gerando croqui" back="/criar" />
        <main className="px-6 py-16 flex flex-col items-center fade-in">
          <div className="w-14 h-14 border-4 border-surface border-t-secondary rounded-full animate-spin" />
          <p className="mt-6 text-[15px] text-muted-foreground transition-opacity">{MSGS[msg]}</p>
        </main>
      </>
    );
  }

  const summary = [
    ["Ocasião", s.ocasiao],
    ["Biotipo", s.biotipo],
    ["Peça", s.peca],
    ["Comprimento", s.comprimento],
    ["Cor", s.cor],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <>
      <Header title="Seu croqui" back="/criar" />
      <main className="px-5 py-5 pb-28 space-y-5 fade-in">
        <div className="rounded-2xl overflow-hidden shadow-card bg-muted aspect-[3/4]">
          <img src={s.croquiUrl!} alt="Croqui gerado" className="w-full h-full object-cover" />
        </div>

        <div className="card-soft bg-muted">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Resumo</p>
          <ul className="divide-y">
            {summary.map(([k, v]) => (
              <li key={k} className="flex justify-between py-2 text-sm">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </li>
            ))}
          </ul>
        </div>

        <Link to="/criar" className="btn-secondary text-center block">Ajustar detalhes</Link>
        <button className="btn-primary" onClick={() => router.navigate({ to: "/realista" })}>
          Gerar foto realista 📸
        </button>
      </main>
    </>
  );
}
