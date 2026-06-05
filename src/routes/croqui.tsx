import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { MessageCircle, Printer, Camera, Pencil } from "lucide-react";
import { generateCroquiFn, saveLookDbFn } from "@/server/api";

import { LoadingScreen } from "@/components/LoadingScreen";

export const Route = createFileRoute("/croqui")({
  component: Croqui,
  head: () => ({ meta: [{ title: "Seu croqui — C&N Tecidos" }] }),
});

const MSGS = [
  "Desenhando seu croqui...",
  "A Crispim está dando vida à sua ideia ✨",
  "Quase lá!",
];

function Croqui() {
  const router = useRouter();
  const s = useLook();
  const [loading, setLoading] = useState(!s.croquiUrl);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  useEffect(() => {
    if (!loading) return;
    
    let active = true;

    async function doGeneration() {
      try {
        const res = await generateCroquiFn({
          data: {
            peca: s.peca,
            biotipo: s.biotipo,
            comprimento: s.comprimento,
            decote: s.decote,
            manga: s.manga,
            saia: s.saia,
            renda: s.renda,
            comentario: s.comentario,
          }
        });
        
        if (!active) return;
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
        
        if (!active) return;
        s.set({ dbId: dbRes.id }); 
      } catch (err) {
        if (!active) return;
        console.error(err);
        alert("Erro ao gerar croqui. Tente novamente.");
        router.history.back();
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    
    doGeneration();
    return () => {
      active = false;
    };
  }, [loading]);

  const handlePrint = () => window.print();

  if (loading) {
    return <LoadingScreen initialStatus="Desenhando seu croqui..." statuses={MSGS} estimatedDuration={12000} />;
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
      <Stepper current="croqui" />
      <main className="container-wide px-5 py-5 pb-8 fade-in">
        <div className="split-layout">
          {/* Left — Image */}
          <div className="split-main">
            <div className="image-frame">
              <img src={s.croquiUrl!} alt="Croqui gerado" />
            </div>
          </div>

          {/* Right — Summary + Actions */}
          <div className="split-aside space-y-5">
            <div className="card-soft bg-muted/50">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Resumo</p>
              <ul className="divide-y">
                {summary.map(([k, v]) => (
                  <li key={k} className="flex justify-between py-2.5 text-sm">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium">{v}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <button className="btn-primary" onClick={() => router.navigate({ to: "/realista" })}>
                <Camera size={18} /> Gerar foto realista
              </button>
              <button onClick={() => setShowLeadModal(true)} className="btn-secondary flex items-center justify-center gap-2">
                <MessageCircle size={18} /> Enviar por WhatsApp
              </button>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowAdjust((prev) => !prev)} 
                  className={`btn-secondary flex items-center justify-center gap-2 flex-1 transition-all ${showAdjust ? 'bg-primary/10 border-primary text-primary' : ''}`}
                >
                  <Pencil size={14} /> Ajustar
                </button>
                <button onClick={handlePrint} className="btn-secondary flex items-center justify-center gap-2 flex-1">
                  <Printer size={16} /> Imprimir
                </button>
              </div>

              {/* Seção de Ajuste integrada e fluida */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdjust ? 'max-h-[300px] opacity-100 border-t pt-4 mt-2' : 'max-h-0 opacity-0 pointer-events-none'}`}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ajustar Detalhes</span>
                  </div>
                  <textarea
                    className="w-full min-h-[80px] p-3 border rounded-xl bg-card text-foreground placeholder:text-muted-foreground text-[13px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none transition-all"
                    placeholder="Descreva as alterações. Ex: Adicionar um laço grande nas costas..."
                    value={s.comentario || ""}
                    onChange={(e) => s.set({ comentario: e.target.value || null })}
                  />
                  <button 
                    onClick={() => {
                      s.set({ croquiUrl: null, realistaUrl: null, dbId: null });
                      setLoading(true);
                    }} 
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    <Pencil size={14} /> Reenviar Croqui
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <WhatsAppModal
        open={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        croquiUrl={s.croquiUrl!}
        realistaUrl={null}
        dbId={s.dbId}
      />
    </>
  );
}
