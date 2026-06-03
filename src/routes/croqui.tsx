import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { useEffect, useState } from "react";
import { MessageCircle, Printer } from "lucide-react";
import { generateCroquiFn, saveLookDbFn, sendWhatsAppLookFn, updateLookDbFn } from "@/server/api";

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

  const handleSubmitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !telefone) return;
    setSubmittingLead(true);
    try {
      try {
        if (s.dbId) {
          await updateLookDbFn({
            data: {
              id: s.dbId,
              update: { nome_cliente: nome, telefone_cliente: telefone }
            }
          });
        }
      } catch (dbErr) {
        console.warn("[DB] Failed to update lead:", dbErr);
      }

      await sendWhatsAppLookFn({
        data: {
          nome,
          telefone,
          croquiUrl: s.croquiUrl!,
          realistaUrl: null
        }
      });

      setLeadSaved(true);
      setTimeout(() => {
        setShowLeadModal(false);
        setLeadSaved(false);
        setNome("");
        setTelefone("");
      }, 3000);
    } catch (err) {
      console.error("Erro ao salvar contato:", err);
      alert("Erro ao enviar. Por favor, verifique o número e tente novamente.");
    } finally {
      setSubmittingLead(false);
    }
  };

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

        <div className="space-y-3">
          <button className="btn-primary" onClick={() => router.navigate({ to: "/realista" })}>
            Gerar foto realista 📸
          </button>
          <button onClick={() => setShowLeadModal(true)} className="btn-secondary flex items-center justify-center gap-2">
            <MessageCircle size={18} /> Enviar por WhatsApp
          </button>
          <div className="flex gap-3">
            <Link to="/criar" className="btn-secondary flex items-center justify-center flex-1">Ajustar detalhes</Link>
            <button onClick={handlePrint} className="btn-secondary flex items-center justify-center gap-2 flex-1">
              <Printer size={16} /> Imprimir
            </button>
          </div>
        </div>
      </main>

      {showLeadModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-5 fade-in">
          <div className="bg-card w-full max-w-md rounded-2xl border shadow-lg overflow-hidden p-6 space-y-4 relative">
            <h3 className="text-lg font-bold text-foreground">Receber croqui no WhatsApp</h3>
            <p className="text-xs text-muted-foreground">
              Insira seus dados abaixo para enviar o croqui para o seu número e salvar seu contato.
            </p>
            {leadSaved ? (
              <div className="py-6 text-center text-primary font-semibold text-sm animate-pulse">
                ✓ Enviado! Verifique o seu WhatsApp.
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
                    {submittingLead ? "Enviando..." : "Receber croqui"}
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
