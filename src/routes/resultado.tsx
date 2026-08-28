import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { useLook } from "@/lib/store";
import { resetLookAndNavigateHome } from "@/lib/flowReset";
import { useEffect, useState } from "react";
import { MessageCircle, RotateCcw, Palette, Sparkles } from "lucide-react";

import { generateRealistaFn, updateLookDbFn } from "@/server/api";

import { LoadingScreen } from "@/components/LoadingScreen";
import { ErrorModal } from "@/components/ErrorModal";
import { RatingStars } from "@/components/RatingStars";

export const Route = createFileRoute("/resultado")({
  component: Resultado,
  head: () => ({ meta: [{ title: "Sua peça — C&N Tecidos" }] }),
});

const MSGS = ["Renderizando sua peça...", "Aplicando o tecido...", "Quase pronto!"];

function Resultado() {
  const router = useRouter();
  const s = useLook();
  const [loading, setLoading] = useState(!s.realistaUrl);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dynamicMsgs = [
    `Renderizando sua peça, ${s.nome || "..."}...`,
    "Aplicando o tecido...",
    `Seu look está pronto, ${s.nome || "..."}!`,
  ];

  useEffect(() => {
    if (!loading) return;
    
    let active = true;

    async function doGeneration() {
      try {
        if (s.modo === "foto" && !s.fotoUrl) {
           throw new Error("Foto do usuário é obrigatória para este passo.");
        }
        
        const res = await generateRealistaFn({
          data: {
            peca: s.peca,
            cor: s.cor,
            userImageUrl: s.fotoUrl,
            croquiUrl: s.croquiUrl,
            modo: s.modo,
            executionId: s.executionId || undefined,
            biotipo: s.biotipo,
            comprimento: s.comprimento,
            decote: s.decote,
            manga: s.manga,
            possuiManga: s.possuiManga,
            saia: s.saia,
            renda: s.renda,
            comentario: s.comentario,
            tecidoImageUrl: s.tecidoImageUrl,
            tecidoPantone: s.tecidoPantone,
            tecidoSku: s.tecidoSku,
            tecidoNome: s.tecidoNome,
            ocasiao: s.ocasiao,
          }
        });
        
        if (!active) return;
        s.set({ realistaUrl: res.url, executionId: res.executionId, realistaArtifactId: res.artifactId, trackingStatus: res.trackingStatus });
        
        if (s.dbId) {
          try {
            await updateLookDbFn({
              data: {
                id: s.dbId,
                update: {
                  realista_url: res.url,
                  execution_id: res.executionId,
                }
              }
            });
          } catch (dbErr) {
            console.warn("[DB] Erro ao atualizar look:", dbErr);
          }
        }
      } catch (err) {
        if (!active) return;
        console.error(err);
        setError("Não conseguimos gerar a visualização realista devido a uma falha de conexão ou processamento. Por favor, tente novamente.");
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

  if (loading) {
    return <LoadingScreen initialStatus="Renderizando sua peça..." statuses={dynamicMsgs} estimatedDuration={15000} />;
  }

  const resetToHome = () => resetLookAndNavigateHome(s, router);

  return (
    <>
      <Header title="Seu look" back="/realista" />
      <Stepper current="resultado" />
      <main className="container-wide px-5 py-5 pb-8 fade-in">
        <div className="split-layout">
          {/* Left — Image with celebration effect */}
          <div className="split-main result-celebrate">
            <div className="image-frame">
              <img src={s.realistaUrl!} alt="Look final" />
            </div>
            <RatingStars artifactId={s.realistaArtifactId} executionId={s.executionId} trackingStatus={s.trackingStatus} label="Esta foto realista ficou satisfatória?" />
          </div>

          {/* Right — Info + Actions */}
          <div className="split-aside space-y-5 stagger-children">
            <div className="card-soft">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, rgba(230, 222, 201, 0.2), rgba(229, 211, 162, 0.1))", color: "#E6DEC9" }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>
                    {s.nome ? (
                      <>
                        <span className="font-bold text-primary">{s.nome}</span>, aqui está seu {s.peca?.toLowerCase() || "look"}
                      </>
                    ) : (
                      s.peca ?? "Sua peça"
                    )}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    {s.cor && `Cor: ${s.cor} · `}{new Date().toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button onClick={() => setShowLeadModal(true)} className="btn-primary flex items-center justify-center gap-2 w-full">
                <MessageCircle size={18} /> Enviar por WhatsApp
              </button>
              
              <button onClick={resetToHome} className="btn-secondary flex items-center justify-center gap-2">
                <RotateCcw size={18} /> Limpar tudo e voltar ao início
              </button>
            </div>
          </div>
        </div>
      </main>

      <WhatsAppModal
        open={showLeadModal}
        onClose={() => setShowLeadModal(false)}
        croquiUrl={s.croquiUrl!}
        realistaUrl={s.realistaUrl}
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
