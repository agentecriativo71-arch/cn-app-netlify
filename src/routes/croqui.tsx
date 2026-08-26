import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { useLook } from "@/lib/store";
import { useEffect, useRef, useState } from "react";
import { MessageCircle, Printer, Camera, Pencil } from "lucide-react";
import { generateCroquiFn, saveLookDbFn } from "@/server/api";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorModal } from "@/components/ErrorModal";
import { RatingStars } from "@/components/RatingStars";

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
  const [error, setError] = useState<string | null>(null);

  const dynamicMsgs = [
    `Desenhando seu croqui, ${s.nome || "..."}...`,
    "A Crispim está dando vida à sua ideia ✨",
    `Falta pouco, ${s.nome || "..."}!`,
  ];
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);

  const lastCroquiRef = useState<string | null>(s.croquiUrl)[0];

  useEffect(() => {
    if (!loading) return;
    
    let active = true;

    async function doGeneration() {
      try {
        const res = await generateCroquiFn({
          data: {
            peca: s.peca || "",
            biotipo: s.biotipo,
            comprimento: s.comprimento,
            decote: s.decote,
            manga: s.manga,
            possuiManga: s.possuiManga,
            saia: s.saia,
            renda: s.renda,
            comentario: s.comentario,
            ocasiao: s.ocasiao,
            tipoCerimonia: s.tipoCerimonia,
            rendaDecisao: s.rendaDecisao,
            previousCroquiUrl: lastCroquiRef || undefined,
          }
        });
        
        if (!active) return;
        s.set({ croquiUrl: res.url, executionId: res.executionId, croquiArtifactId: res.artifactId, trackingStatus: res.trackingStatus });
        
        let dbId: string | null = null;
        try {
          const dbRes = await saveLookDbFn({
            data: {
              ocasiao: s.ocasiao,
              tipo_cerimonia: s.tipoCerimonia,
              renda_decisao: s.rendaDecisao,
              biotipo: s.biotipo,
              peca: s.peca,
              comprimento: s.comprimento,
              decote: s.decote,
              manga: s.manga,
              possui_manga: s.possuiManga,
              cor: s.cor,
              saia: s.saia,
              renda: s.renda,
              comentario: s.comentario,
              generation_provider: "fal",
              generation_model: "seedream-v4",
              generation_prompt_version: res.metadata?.promptVersion,
              generation_candidates: res.metadata?.candidates,
              specification: {
                ocasiao: s.ocasiao,
                tipoCerimonia: s.tipoCerimonia,
                rendaDecisao: s.rendaDecisao,
                biotipo: s.biotipo,
                peca: s.peca,
                comprimento: s.comprimento,
                decote: s.decote,
                possuiManga: s.possuiManga,
                manga: s.manga,
                saia: s.saia,
                renda: s.renda,
                cor: s.cor,
                comentario: s.comentario,
              },
              croqui_url: res.url,
              nome_cliente: s.nome || undefined,
              execution_id: res.executionId,
            }
          });
          dbId = dbRes.id;
        } catch (dbErr) {
          console.warn("[DB] Erro ao salvar look:", dbErr);
        }
        
        if (!active) return;
        if (dbId) {
          s.set({ dbId });
        }
      } catch (err) {
        if (!active) return;
        console.error(err);
        setError("Não conseguimos desenhar seu croqui devido a uma falha de conexão ou processamento. Por favor, tente novamente.");
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

  const qrPersistingRef = useRef(false);
  useEffect(() => {
    if (loading || !s.croquiUrl || !s.croquiUploadSessionId || s.dbId || qrPersistingRef.current) return;
    qrPersistingRef.current = true;
    saveLookDbFn({
      data: {
        ocasiao: s.ocasiao,
        biotipo: s.biotipo,
        peca: s.peca,
        comprimento: s.comprimento,
        decote: s.decote,
        manga: s.manga,
        possui_manga: s.possuiManga,
        saia: s.saia,
        renda: s.renda,
        renda_decisao: s.rendaDecisao,
        comentario: s.comentario,
        croqui_url: s.croquiUrl,
        nome_cliente: s.nome || undefined,
        execution_id: s.executionId,
      },
    }).then((res: { id: string }) => s.set({ dbId: res.id })).catch((error: unknown) => {
      qrPersistingRef.current = false;
      console.warn("[DB] Erro ao salvar look QR:", error);
    });
  }, [loading, s.croquiUrl, s.croquiUploadSessionId, s.dbId, s.executionId]);

  const handlePrint = () => window.print();

  if (loading) {
    return <LoadingScreen initialStatus="Desenhando seu croqui..." statuses={dynamicMsgs} estimatedDuration={12000} />;
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
            <RatingStars artifactId={s.croquiArtifactId} executionId={s.executionId} label="Este croqui ficou satisfatório?" />
            {s.costasProposta && <p className="mt-2 text-xs text-white/60 text-center">Costas são proposta da IA</p>}
          </div>

          {/* Right — Summary + Actions */}
          <div className="split-aside space-y-5 stagger-children">
            <div className="card-soft">
              <p className="text-[11px] uppercase tracking-wider font-bold mb-2 text-[#E6DEC9]">
                {s.nome ? `Croqui de ${s.nome}` : "Resumo"}
              </p>
              <ul className="divide-y" style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}>
                {summary.map(([k, v]) => (
                  <li key={k} className="flex justify-between py-2.5 text-sm">
                    <span className="text-white/70 font-medium">{k}</span>
                    <span className="text-white font-bold">{v}</span>
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
                  className="btn-secondary flex items-center justify-center gap-2 flex-1 transition-all"
                  style={showAdjust ? { background: "oklch(0.96 0.03 160 / 0.8)", borderColor: "var(--color-primary)", color: "var(--color-primary)" } : {}}
                >
                  <Pencil size={14} /> Ajustar
                </button>
                <button onClick={handlePrint} className="btn-secondary flex items-center justify-center gap-2 flex-1">
                  <Printer size={16} /> Imprimir
                </button>
              </div>

              {/* Seção de Ajuste integrada e fluida */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showAdjust ? 'max-h-[300px] opacity-100 border-t pt-4 mt-2' : 'max-h-0 opacity-0 pointer-events-none'}`}
                style={{ borderColor: "rgba(255, 255, 255, 0.15)" }}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-semibold uppercase tracking-wider" style={{ fontFamily: "var(--font-display)", color: "rgba(255, 255, 255, 0.7)" }}>Ajustar Detalhes</span>
                  </div>
                  <textarea
                    className="w-full min-h-[80px] p-3 rounded-xl text-[13px] leading-relaxed resize-none transition-all placeholder:text-white/35"
                    style={{
                      border: "1.5px solid rgba(255, 255, 255, 0.2)",
                      background: "rgba(255, 255, 255, 0.08)",
                      color: "white",
                      outline: "none",
                    }}
                    placeholder="Descreva as alterações. Ex: Adicionar um laço grande nas costas..."
                    value={s.comentario || ""}
                    onChange={(e) => s.set({ comentario: e.target.value || null })}
                  />
                  <button 
                    onClick={() => {
                      s.set({ croquiUrl: null, realistaUrl: null, dbId: null, croquiArtifactId: null, realistaArtifactId: null });
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

      <ErrorModal
        open={!!error}
        message={error || undefined}
        onRetry={() => {
          setError(null);
          router.navigate({ to: "/criar" });
        }}
      />
    </>
  );
}
