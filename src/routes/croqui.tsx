import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { MessageCircle, Printer, Camera, Pencil } from "lucide-react";
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
  const [showLeadModal, setShowLeadModal] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const i = setInterval(() => setMsg((m) => (m + 1) % MSGS.length), 1500);
    
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
      clearInterval(i);
    };
  }, [loading]);

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <>
        <Header title="Gerando croqui" back="/criar" />
        <Stepper current="croqui" />
        <main className="container-app px-6 py-16 flex flex-col items-center fade-in">
          <div className="spinner-brand" />
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
                <Link to="/criar" className="btn-secondary flex items-center justify-center gap-2 flex-1">
                  <Pencil size={14} /> Ajustar
                </Link>
                <button onClick={handlePrint} className="btn-secondary flex items-center justify-center gap-2 flex-1">
                  <Printer size={16} /> Imprimir
                </button>
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
