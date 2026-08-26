import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Upload, Sparkles, Smartphone, Loader2, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { createUploadSessionFn, pollUploadSessionFn, retryReferenceGenerationFn } from "@/server/api";
import { REFERENCE_PIECES, referenceAnalysisToCroquiSpecs, type ReferencePiece } from "@/lib/referenceUtils";
import { useLook } from "@/lib/store";
import { CRISPIM_AI_LABEL } from "@/lib/brandCopy";
import { useRouter } from "@tanstack/react-router";

import ocasiaoCasamento from "@/assets/ocasiao-casamento.png";
import ocasiaoFesta from "@/assets/ocasiao-festa.png";
import ocasiaoTrabalho from "@/assets/ocasiao-trabalho.png";
import ocasiaoCasual from "@/assets/ocasiao-casual.png";

const OCASIOES_ITEMS = [
  { nome: "Noiva", image_url: ocasiaoCasamento }, { nome: "Festa", image_url: ocasiaoFesta },
  { nome: "Casual", image_url: ocasiaoCasual }, { nome: "Fardamento", image_url: ocasiaoTrabalho },
];

interface CroquiModoModalProps { open: boolean; nome: string; onClose: () => void; onSelectCriarDoZero: () => void; }
type ModalStep = "choice" | "piece" | "ocasiao" | "qr";

export function CroquiModoModal({ open, nome, onClose, onSelectCriarDoZero }: CroquiModoModalProps) {
  const router = useRouter();
  const s = useLook();
  const [step, setStep] = useState<ModalStep>("choice");
  const [referencePiece, setReferencePiece] = useState<ReferencePiece | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("pending");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("choice"); setReferencePiece(null); setSessionId(null); setLoadingSession(false); setSessionStatus("pending"); setUploadSuccess(false); setRetrying(false); setModalError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!sessionId || uploadSuccess) return;
    const interval = setInterval(async () => {
      try {
        const res = await pollUploadSessionFn({ data: { sessionId } });
        const session = res.session;
        if (!session) return;
        setSessionStatus(session.status);
        if (session.status === "generation_failed") setModalError("O croqui não pôde ser gerado. Tente novamente.");
        if (["needs_recrop", "unsupported_garment"].includes(session.status)) setModalError("O recorte não confirmou a peça selecionada. Envie um novo recorte pelo celular.");
        if (session.status === "uploaded" && session.croqui_url) {
          setUploadSuccess(true);
          const specs = session.reference_analysis ? referenceAnalysisToCroquiSpecs(session.reference_analysis, session.ocasiao || undefined) : session.specs || {};
          const costasObservation = session.reference_analysis?.detalhesTecnicos.costas;
          const costasText = String(costasObservation?.value || costasObservation?.evidence || "").toLowerCase();
          const costasProposta = !costasObservation?.value || /(não|nao|invis|desconhe|ausent|ocult)/i.test(costasText);
          s.set({ croquiUrl: session.croqui_url, croquiUploadSessionId: sessionId, possuiManga: specs.possuiManga ?? null, costasProposta, ...(specs.peca ? { peca: specs.peca } : {}), ...(specs.comprimento ? { comprimento: specs.comprimento } : {}), ...(specs.decote ? { decote: specs.decote } : {}), ...(specs.manga ? { manga: specs.manga } : {}), ...(specs.saia ? { saia: specs.saia } : {}), ...(specs.renda ? { renda: specs.renda } : {}), ...(specs.rendaDecisao !== undefined ? { rendaDecisao: specs.rendaDecisao } : {}), ...(specs.comentario ? { comentario: specs.comentario } : {}) });
          setTimeout(() => { onClose(); router.navigate({ to: "/croqui" }); }, 900);
        }
      } catch (err) { console.error("[POLL] Erro ao consultar sessão:", err); }
    }, 2500);
    return () => clearInterval(interval);
  }, [sessionId, uploadSuccess, onClose, router, s]);

  if (!open) return null;

  const handleSelectPiece = (peca: ReferencePiece) => {
    setReferencePiece(peca);
    setStep("ocasiao");
  };

  const handleSelectOcasiao = async (ocasiao: string) => {
    if (!referencePiece) return;
    s.set({ ocasiao }); setLoadingSession(true); setModalError(null);
    try {
      const res = await createUploadSessionFn({ data: { nomeCliente: nome, ocasiao, peca: referencePiece } });
      if (res.session?.id) { setSessionId(res.session.id); setStep("qr"); }
    } catch (err) { console.error("[SESSION] Erro ao criar sessão:", err); setModalError("Não foi possível preparar a sessão de referência."); }
    finally { setLoadingSession(false); }
  };

  const retryGeneration = async () => {
    if (!sessionId) return;
    setRetrying(true); setModalError(null); setSessionStatus("generating");
    try { await retryReferenceGenerationFn({ data: { sessionId } }); }
    catch (err) { console.error("[RETRY GENERATION] Erro:", err); setModalError("A nova tentativa de geração falhou."); setSessionStatus("generation_failed"); }
    finally { setRetrying(false); }
  };

  const uploadUrl = typeof window !== "undefined" && sessionId ? `${window.location.origin}/upload/${sessionId}` : "";
  return <div className="modal-overlay z-50" onClick={(event) => event.target === event.currentTarget && onClose()}><div className="modal-card max-w-lg space-y-6 text-center select-none fade-in">
    {step === "choice" && <ChoiceStep nome={nome} onReference={() => setStep("piece")} onClose={onClose} onSelectCriarDoZero={onSelectCriarDoZero} />}
    {step === "piece" && <PieceStep onBack={() => setStep("choice")} onSelect={handleSelectPiece} />}
    {step === "ocasiao" && <OccasionStep referencePiece={referencePiece} loading={loadingSession} onBack={() => setStep("choice")} onSelect={handleSelectOcasiao} />}
    {step === "qr" && <QrStep uploadUrl={uploadUrl} status={sessionStatus} uploadSuccess={uploadSuccess} error={modalError} retrying={retrying} onBack={() => setStep("ocasiao")} onRetry={retryGeneration} />}
    {modalError && step !== "qr" && <p className="text-xs text-red-300">{modalError}</p>}
  </div></div>;
}

function ChoiceStep({ nome, onReference, onClose, onSelectCriarDoZero }: { nome: string; onReference: () => void; onClose: () => void; onSelectCriarDoZero: () => void }) {
  return <><div className="space-y-2"><span className="text-[11px] tracking-[0.3em] font-semibold text-[#E5D3A2] uppercase">C&N TECIDOS</span><h3 className="text-2xl font-extrabold text-[#E6DEC9] uppercase">Olá, {nome}!</h3><p className="text-sm text-white/70 max-w-xs mx-auto">Você já possui a foto ou print de um modelo ou prefere criar um do zero?</p></div><div className="space-y-3 pt-2"><button onClick={onReference} className="w-full p-4 rounded-2xl bg-white/10 border border-[#E5D3A2]/40 flex items-center justify-between text-left"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-[#E5D3A2]/20 flex items-center justify-center text-[#E5D3A2]"><Upload size={24} /></div><div><h4 className="text-sm font-bold text-white uppercase tracking-wider">Já tenho um modelo</h4><p className="text-xs text-white/60">Enviar recortes pelo celular via QR Code</p></div></div><Smartphone size={20} className="text-[#E5D3A2]" /></button><button onClick={onSelectCriarDoZero} className="w-full p-4 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-between text-left"><div className="flex items-center gap-3"><div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-white/80"><Sparkles size={24} /></div><div><h4 className="text-sm font-bold text-white uppercase tracking-wider">Quero criar um novo</h4><p className="text-xs text-white/60">Desenhar com a {CRISPIM_AI_LABEL}</p></div></div></button></div><button onClick={onClose} className="text-xs text-white/40 uppercase tracking-widest pt-2">Cancelar</button></>;
}

function PieceStep({ onBack, onSelect }: { onBack: () => void; onSelect: (peca: ReferencePiece) => void }) {
  return <><div className="flex items-center justify-between border-b border-white/10 pb-3"><button onClick={onBack} className="text-white/60 flex items-center gap-1.5 text-xs font-semibold uppercase"><ArrowLeft size={16} /> Voltar</button><span className="text-xs font-bold text-[#E5D3A2] uppercase tracking-widest">Tipo da peça</span><div className="w-12" /></div><div className="py-2 space-y-4"><p className="text-sm text-white/70 max-w-xs mx-auto">Qual tipo de roupa a {CRISPIM_AI_LABEL} deve procurar no recorte?</p><p className="text-[10px] text-white/45 max-w-xs mx-auto">Essa escolha orienta o foco da {CRISPIM_AI_LABEL}. Para enviar duas fotos (cima + baixo), escolha Vestido.</p><div className="grid grid-cols-2 gap-2">{REFERENCE_PIECES.map((peca) => <button key={peca} onClick={() => onSelect(peca)} className="p-3 rounded-xl bg-white/5 border border-white/15 text-xs font-bold text-white uppercase hover:border-[#E5D3A2]/60">{peca}</button>)}</div></div></>;
}

function OccasionStep({ referencePiece, loading, onBack, onSelect }: { referencePiece: ReferencePiece | null; loading: boolean; onBack: () => void; onSelect: (occasion: string) => void }) {
  const availableOccasions = OCASIOES_ITEMS.filter((item) => item.nome !== "Noiva" || referencePiece === "Vestido");
  return <><div className="flex items-center justify-between border-b border-white/10 pb-3"><button onClick={onBack} className="text-white/60 flex items-center gap-1.5 text-xs font-semibold uppercase"><ArrowLeft size={16} /> Voltar</button><span className="text-xs font-bold text-[#E5D3A2] uppercase tracking-widest">Ocasião do look</span><div className="w-12" /></div><div className="py-2 space-y-4"><p className="text-sm text-white/70 max-w-xs mx-auto">Qual a ocasião desse vestido/look?</p><div className="grid grid-cols-2 gap-3">{availableOccasions.map((item) => <button key={item.nome} onClick={() => onSelect(item.nome)} disabled={loading} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5"><div className="w-16 h-16 rounded-xl bg-black/30 overflow-hidden"><img src={item.image_url} alt={item.nome} className="w-full h-full object-cover" /></div><span className="text-xs font-bold text-white uppercase">{item.nome}</span></button>)}</div>{loading && <div className="flex items-center justify-center gap-2 text-xs text-[#E5D3A2]"><Loader2 size={16} className="animate-spin" /> Preparando ambiente...</div>}</div></>;
}

function QrStep({ uploadUrl, status, uploadSuccess, error, retrying, onBack, onRetry }: { uploadUrl: string; status: string; uploadSuccess: boolean; error: string | null; retrying: boolean; onBack: () => void; onRetry: () => void }) {
  const statusMessage = status === "needs_recrop" || status === "unsupported_garment"
    ? <><RefreshCw size={16} /> Ajuste o recorte para deixar apenas a peça selecionada e envie novamente.</>
    : status === "analysis_failed"
      ? <>Falha na análise. Envie um novo recorte.</>
      : status === "analyzing"
        ? <><Loader2 size={16} className="animate-spin" /> Analisando o recorte...</>
        : status === "analysis_ready" || status === "generating"
          ? <><Loader2 size={16} className="animate-spin" /> Análise concluída. Gerando o croqui...</>
          : <><Loader2 size={16} className="animate-spin" /> Aguardando envio pelo celular...</>;

  return <><div className="flex items-center justify-between border-b border-white/10 pb-3"><button onClick={onBack} className="text-white/60 flex items-center gap-1.5 text-xs font-semibold uppercase"><ArrowLeft size={16} /> Voltar</button><span className="text-xs font-bold text-[#E5D3A2] uppercase tracking-widest">Enviar pelo celular</span><div className="w-12" /></div>{uploadSuccess ? <div className="py-8 space-y-4"><CheckCircle2 size={44} className="mx-auto text-emerald-400" /><h4 className="text-xl font-bold text-white uppercase">Modelo recebido</h4><p className="text-xs text-white/70">Abrindo o croqui...</p></div> : <div className="space-y-5 py-2"><p className="text-xs text-white/80 max-w-sm mx-auto">Aponte a câmera para o QR Code e envie somente o recorte da roupa ou pessoa principal.</p><div className="bg-white p-4 rounded-2xl inline-block shadow-2xl border-4 border-[#E5D3A2]"><QRCodeSVG value={uploadUrl} size={190} level="H" includeMargin={false} /></div><div className="flex items-center justify-center gap-2 text-xs text-[#E5D3A2]">{statusMessage}</div>{error && status === "generation_failed" && <><p className="text-xs text-red-300">{error}</p><button onClick={onRetry} disabled={retrying} className="w-full py-3 rounded-xl bg-[#E5D3A2] text-black text-xs font-bold uppercase">{retrying ? "Tentando..." : "Tentar gerar novamente"}</button></>}<div className="text-[10px] text-white/40 break-all max-w-xs mx-auto">Ou acesse: <span className="underline">{uploadUrl}</span></div></div>}</>;
}
