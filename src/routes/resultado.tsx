import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { Download, MessageCircle, RotateCcw } from "lucide-react";

import { generateRealistaFn, updateLookDbFn } from "@/server/api";

export const Route = createFileRoute("/resultado")({
  component: Resultado,
  head: () => ({ meta: [{ title: "Sua peça — C&N Tecidos" }] }),
});

const MSGS = ["Renderizando sua peça...", "Aplicando o tecido...", "Quase pronto!"];

const WHATSAPP = "https://wa.me/5500000000000?text=Oi%20Camila%2C%20vi%20meu%20look%20no%20app%20e%20quero%20saber%20mais!";

function Resultado() {
  const router = useRouter();
  const s = useLook();
  const [loading, setLoading] = useState(!s.realistaUrl);
  const [msg, setMsg] = useState(0);

  useEffect(() => {
    if (!loading) return;
    const i = setInterval(() => setMsg((m) => (m + 1) % MSGS.length), 1500);
    
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
      clearInterval(i);
    };
  }, [loading]);

  if (loading) {
    return (
      <>
        <Header title="Gerando foto" back="/realista" />
        <main className="px-6 py-16 flex flex-col items-center fade-in">
          <div className="w-14 h-14 border-4 border-surface border-t-secondary rounded-full animate-spin" />
          <p className="mt-6 text-[15px] text-muted-foreground">{MSGS[msg]}</p>
        </main>
      </>
    );
  }

  const reset = () => {
    s.reset();
    router.navigate({ to: "/criar" });
  };

  return (
    <>
      <Header title="Seu look" back="/realista" />
      <main className="px-5 py-5 pb-10 space-y-4 fade-in">
        <div className="rounded-2xl overflow-hidden shadow-card aspect-[3/4] bg-muted">
          <img src={s.realistaUrl!} alt="Look final" className="w-full h-full object-cover" />
        </div>

        <div className="card-soft">
          <p className="font-semibold text-foreground">{s.peca ?? "Sua peça"}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {s.cor && `Cor: ${s.cor} · `} {new Date().toLocaleDateString("pt-BR")}
          </p>
        </div>

        <div className="space-y-3">
          <a href={WHATSAPP} target="_blank" rel="noreferrer" className="btn-primary">
            <MessageCircle size={18} /> Falar com a Camila
          </a>
          <a href={s.realistaUrl!} download className="btn-secondary inline-flex items-center justify-center gap-2">
            <Download size={18} /> Baixar imagem
          </a>
          <button onClick={reset} className="btn-secondary inline-flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Criar outro look
          </button>
        </div>
      </main>
    </>
  );
}
