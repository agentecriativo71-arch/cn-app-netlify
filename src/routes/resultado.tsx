import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { Download, MessageCircle, RotateCcw } from "lucide-react";

import { generateRealistaFn, updateLookDbFn, sendWhatsAppLookFn } from "@/server/api";

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

  // Lead capture states
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [submittingLead, setSubmittingLead] = useState(false);
  const [leadSaved, setLeadSaved] = useState(false);

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

  const handlePrint = () => {
    // Basic browser printing mechanism
    window.print();
  };

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;
    setSubmittingLead(true);
    try {
      // 1. Update Lead details in Database (Non-blocking)
      try {
        if (s.dbId) {
          await updateLookDbFn({
            data: {
              id: s.dbId,
              update: {
                nome_cliente: nome,
                telefone_cliente: telefone
              }
            }
          });
        }
      } catch (dbErr) {
        console.warn("[DB] Failed to update lead in database, continuing to send WhatsApp:", dbErr);
      }

      // 2. Call server function to send messages automatically via Evolution API
      await sendWhatsAppLookFn({
        data: {
          nome,
          telefone,
          croquiUrl: s.croquiUrl!,
          realistaUrl: s.realistaUrl
        }
      });

      setLeadSaved(true);

      // Auto close modal after success
      setTimeout(() => {
        setShowLeadModal(false);
        setLeadSaved(false);
        setNome("");
        setTelefone("");
      }, 3000);
    } catch (err) {
      console.error("Erro ao salvar contato ou enviar mensagens:", err);
      alert("Erro ao enviar. Por favor, verifique o número e tente novamente.");
    } finally {
      setSubmittingLead(false);
    }
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
          <button onClick={() => setShowLeadModal(true)} className="btn-primary flex items-center justify-center gap-2 w-full">
            <MessageCircle size={18} /> Enviar por WhatsApp
          </button>
          
          <button onClick={handlePrint} className="btn-secondary inline-flex items-center justify-center gap-2">
            🖨️ Imprimir Look
          </button>
          
          <button onClick={reset} className="btn-secondary inline-flex items-center justify-center gap-2">
            <RotateCcw size={18} /> Criar outro look
          </button>
        </div>
      </main>

      {/* Lead Capture Modal */}
      {showLeadModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-5 fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-lg overflow-hidden p-6 space-y-4 relative">
            <h3 className="text-lg font-bold text-foreground">Receber fotos no WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Insira seus dados abaixo para enviar o croqui e a visualização no manequim para o seu número e salvar seu contato.
            </p>

            {leadSaved ? (
              <div className="py-6 text-center text-primary font-semibold text-sm animate-pulse">
                ✓ Contato salvo! Redirecionando para o WhatsApp...
              </div>
            ) : (
              <form onSubmit={handleSubmitLead} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Nome completo</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Ana Maria Silva"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full p-3 border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp (com DDD)</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 19999999999"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full p-3 border rounded-xl bg-muted/50 text-foreground placeholder:text-muted-foreground text-[13px] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLeadModal(false)}
                    className="btn-secondary py-2 text-xs flex-1"
                    disabled={submittingLead}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary py-2 text-xs flex-1"
                    disabled={submittingLead || !nome || !telefone}
                  >
                    {submittingLead ? "Enviando..." : "Receber fotos"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
