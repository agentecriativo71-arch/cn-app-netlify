import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { Stepper } from "@/components/Stepper";
import { WhatsAppModal } from "@/components/WhatsAppModal";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { MessageCircle, RotateCcw, Palette, Sparkles } from "lucide-react";

import { generateRealistaFn, updateLookDbFn } from "@/server/api";

import { LoadingScreen } from "@/components/LoadingScreen";

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
        s.set({ realistaUrl: res.url });
        
        if (s.dbId) {
          await updateLookDbFn({
            data: {
              id: s.dbId,
              update: {
                realista_url: res.url
              }
            }
          });
        }
      } catch (err) {
        if (!active) return;
        console.error(err);
        alert("Erro ao gerar a foto realista. Tente novamente.");
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

  if (loading) {
    return <LoadingScreen initialStatus="Renderizando sua peça..." statuses={MSGS} estimatedDuration={15000} />;
  }

  const reset = () => {
    s.reset();
    router.navigate({ to: "/criar" });
  };

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
          </div>

          {/* Right — Info + Actions */}
          <div className="split-aside space-y-5 stagger-children">
            <div className="card-soft">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, oklch(0.94 0.04 160), oklch(0.90 0.06 160))", color: "var(--color-primary)" }}
                >
                  <Sparkles size={18} />
                </div>
                <div>
                  <p className="font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--color-foreground)" }}>{s.peca ?? "Sua peça"}</p>
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
              
              <button onClick={reset} className="btn-secondary flex items-center justify-center gap-2">
                <RotateCcw size={18} /> Criar outro look
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
    </>
  );
}
