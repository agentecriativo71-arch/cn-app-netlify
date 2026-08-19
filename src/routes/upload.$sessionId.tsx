// ROTA PÚBLICA — não adicionar auth guard aqui
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pollUploadSessionFn, uploadReferenceFilesFn } from "@/server/api";
import { cropImageToDataUrl, type CropPixels } from "@/lib/imageCrop";
import { buildReferenceUploadPayload } from "@/lib/referenceUpload";
import { REFERENCE_FILE_ACCEPT, isReferenceImageType } from "@/lib/referenceUploadUi";
import { type ReferencePiece } from "@/lib/referenceUtils";
import { ReferenceCropper } from "@/components/ReferenceCropper";
import { Upload, CheckCircle2, Loader2, ImagePlus, RefreshCw, Layers, Sparkles, Crop, X } from "lucide-react";

export const Route = createFileRoute("/upload/$sessionId")({
  component: UploadModeloMobile,
  head: () => ({
    meta: [
      { title: "Enviar Modelo de Referência — C&N Tecidos" },
      { name: "description", content: "Envie um recorte da referência do seu look para a C&N Tecidos" },
    ],
  }),
});

type ImageTarget = "single" | "top" | "bottom";

function UploadModeloMobile() {
  const { sessionId } = Route.useParams();
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [referencePiece, setReferencePiece] = useState<ReferencePiece | null>(null);
  const [status, setStatus] = useState("loading");
  const [mode, setMode] = useState<"single" | "composite">("single");

  const [singleOriginal, setSingleOriginal] = useState<string | null>(null);
  const [singleCrop, setSingleCrop] = useState<string | null>(null);
  const [topOriginal, setTopOriginal] = useState<string | null>(null);
  const [topCrop, setTopCrop] = useState<string | null>(null);
  const [bottomOriginal, setBottomOriginal] = useState<string | null>(null);
  const [bottomCrop, setBottomCrop] = useState<string | null>(null);

  const [cropTarget, setCropTarget] = useState<ImageTarget | null>(null);
  const [cropAreaPixels, setCropAreaPixels] = useState<CropPixels | null>(null);
  const [cropping, setCropping] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const originalUrlsRef = useRef<Record<ImageTarget, string | null>>({ single: null, top: null, bottom: null });

  const clearLocalImages = useCallback(() => {
    for (const url of Object.values(originalUrlsRef.current)) {
      if (url) URL.revokeObjectURL(url);
    }
    originalUrlsRef.current = { single: null, top: null, bottom: null };
    setSingleOriginal(null); setSingleCrop(null); setTopOriginal(null); setTopCrop(null); setBottomOriginal(null); setBottomCrop(null); setCropTarget(null); setCropAreaPixels(null);
  }, []);

  const replaceOriginalUrl = useCallback((target: ImageTarget, url: string) => {
    const previousUrl = originalUrlsRef.current[target];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    originalUrlsRef.current[target] = url;
    if (target === "single") setSingleOriginal(url);
    if (target === "top") setTopOriginal(url);
    if (target === "bottom") setBottomOriginal(url);
  }, []);

  useEffect(() => {
    const clearOnPageExit = () => clearLocalImages();
    window.addEventListener("pagehide", clearOnPageExit);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", clearOnPageExit);
      // Ao desmontar, o estado React deixa de ser alcançável; limpar também os
      // valores ativos evita manter os Data URLs durante a navegação SPA.
      clearLocalImages();
    };
  }, [clearLocalImages]);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await pollUploadSessionFn({ data: { sessionId } });
        if (!mountedRef.current) return;
        if (!res.session) {
          setStatus("invalid");
        } else {
          setNomeCliente(res.session.nome_cliente || null);
          setReferencePiece(res.session.reference_piece || null);
          setStatus(res.session.status === "expired" ? "invalid" : res.session.status === "uploaded" ? "already_uploaded" : "ready");
        }
      } catch (err) {
        if (!mountedRef.current) return;
        console.error("[UPLOAD SESS] Error:", err);
        setStatus("ready");
      }
    }
    loadSession();
  }, [sessionId]);

  const originalForTarget = useMemo(() => ({ single: singleOriginal, top: topOriginal, bottom: bottomOriginal }), [singleOriginal, topOriginal, bottomOriginal]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, target: ImageTarget) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!isReferenceImageType(file.type)) {
      setErrorMsg("Selecione um arquivo de imagem pela câmera ou galeria.");
      return;
    }
    setErrorMsg(null);
    const objectUrl = URL.createObjectURL(file);
    replaceOriginalUrl(target, objectUrl);
    if (target === "single") setSingleCrop(null);
    if (target === "top") setTopCrop(null);
    if (target === "bottom") setBottomCrop(null);
    setCropAreaPixels(null);
    setCropTarget(target);
  };

  const handleApplyCrop = async () => {
    if (!cropTarget || !originalForTarget[cropTarget] || !cropAreaPixels) return;
    setCropping(true);
    try {
      const cropped = await cropImageToDataUrl(originalForTarget[cropTarget], cropAreaPixels);
      if (cropTarget === "single") setSingleCrop(cropped);
      if (cropTarget === "top") setTopCrop(cropped);
      if (cropTarget === "bottom") setBottomCrop(cropped);
      setCropTarget(null);
    } catch (error) {
      console.error("[CROP] Error:", error);
      setErrorMsg("Não foi possível preparar o recorte. Tente outra imagem.");
    } finally {
      setCropping(false);
    }
  };

  const handleCancelCrop = () => setCropTarget(null);
  const isReadyToSubmit = mode === "single" ? !!singleCrop : !!topCrop && !!bottomCrop;
  const compositeAllowed = referencePiece === "Vestido";

  const handleUploadSubmit = async () => {
    if (!isReadyToSubmit) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const result = await uploadReferenceFilesFn({ data: buildReferenceUploadPayload(sessionId, mode, { single: singleCrop, top: topCrop, bottom: bottomCrop }) });
      if (result.status === "needs_recrop") {
        setErrorMsg("A IA não conseguiu confirmar o foco com segurança. Ajuste o recorte para deixar apenas a roupa ou pessoa principal e envie novamente.");
        return;
      }
      if (result.status === "unsupported_garment") {
        setErrorMsg("A peça identificada não é suportada. Selecione um recorte com uma roupa principal visível e tente novamente.");
        return;
      }
      if (result.status === "analysis_failed") {
        setErrorMsg(result.message || "Não foi possível analisar os recortes. Tente novamente.");
        return;
      }
      if (result.status === "generation_failed") {
        setErrorMsg(result.message || "A referência foi analisada, mas o croqui não pôde ser gerado. Tente novamente no totem.");
        return;
      }
      clearLocalImages();
      setStatus("success");
    } catch (error) {
      console.error("[UPLOAD] Error:", error);
      setErrorMsg("Ocorreu uma falha ao analisar o recorte. Tente novamente; nenhuma imagem original foi armazenada.");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") return <CenteredMessage><Loader2 size={32} className="animate-spin text-[#E5D3A2]" /><p>Carregando sessão de upload...</p></CenteredMessage>;
  if (status === "invalid") return <CenteredMessage><div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40">✕</div><h2 className="text-xl font-bold">Sessão inválida ou expirada</h2><p>Solicite um novo QR Code no totem.</p></CenteredMessage>;
  if (status === "success" || status === "already_uploaded") return <CenteredMessage><div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40"><CheckCircle2 size={48} /></div><h2 className="text-2xl font-extrabold uppercase">Referência recebida</h2><p>{nomeCliente ? `Obrigado, ${nomeCliente}! ` : ""}O croqui está sendo preparado automaticamente no totem.</p></CenteredMessage>;

  const cropImage = cropTarget ? originalForTarget[cropTarget] : null;

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between p-4 sm:p-6 select-none max-w-md mx-auto">
      <header className="text-center pt-2 pb-3 space-y-1 border-b border-white/10">
        <span className="text-[10px] tracking-[0.35em] font-semibold text-[#E5D3A2] uppercase">CN TECIDOS</span>
        <h1 className="text-xl font-extrabold text-[#E6DEC9] uppercase tracking-tight">Enviar recorte de referência</h1>
        {nomeCliente && <p className="text-xs text-white/60">Cliente: <span className="text-white font-semibold">{nomeCliente}</span></p>}
      </header>

      <div className="pt-3">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button type="button" onClick={() => setMode("single")} className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl ${mode === "single" ? "bg-[#E5D3A2] text-black" : "text-white/60"}`}>1 foto geral</button>
          <button type="button" onClick={() => compositeAllowed && setMode("composite")} disabled={!compositeAllowed} className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl ${mode === "composite" ? "bg-[#E5D3A2] text-black" : "text-white/60 disabled:opacity-35"}`}>2 fotos (cima + baixo)</button>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center py-4 space-y-4">
        <p className="text-xs text-center text-white/70">A IA procura o tipo <span className="text-[#E5D3A2] font-bold">{referencePiece || "selecionado no totem"}</span>. Recorte a pessoa ou roupa principal para deixar esse foco claro, mesmo que haja outras pessoas ou objetos na foto.</p>
        {!compositeAllowed && <p className="text-[10px] text-center text-white/45">O modo “cima + baixo” é reservado para Vestido. Para este tipo de peça, envie uma foto geral.</p>}
        <p className="text-[10px] leading-relaxed text-center text-white/45 max-w-sm">Privacidade: a foto original permanece neste aparelho. Somente o recorte confirmado será analisado pelo GPT-5 e não será armazenado pelo aplicativo.</p>
        {mode === "single" ? <SingleSlot preview={singleCrop} onChange={(event) => handleFileChange(event, "single")} onRecrop={() => setCropTarget("single")} /> : <div className="grid grid-cols-2 gap-3 w-full"><CompositeSlot label="1. Busto / cima" preview={topCrop} onChange={(event) => handleFileChange(event, "top")} onRecrop={() => setCropTarget("top")} /><CompositeSlot label="2. Saia / baixo" preview={bottomCrop} onChange={(event) => handleFileChange(event, "bottom")} onRecrop={() => setCropTarget("bottom")} /></div>}
        {errorMsg && <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs text-center w-full">{errorMsg}</div>}
      </main>

      <footer className="pb-2 pt-2"><button onClick={handleUploadSubmit} disabled={!isReadyToSubmit || uploading || !!cropTarget} className="w-full py-4 rounded-2xl bg-[#E5D3A2] text-black font-extrabold uppercase tracking-wider text-sm shadow-xl disabled:opacity-40 flex items-center justify-center gap-2">{uploading ? <><Loader2 size={18} className="animate-spin" /> Analisando recortes...</> : <><Sparkles size={18} /> Enviar análise ao totem</>}</button></footer>

      {cropTarget && cropImage && <div className="fixed inset-0 z-50 bg-black/95 p-4 flex flex-col justify-center gap-4"><div className="flex items-center justify-between"><div><p className="text-[#E5D3A2] text-xs uppercase tracking-wider font-bold">Selecionar foco</p><p className="text-white/70 text-xs">Arraste a área e ajuste os quatro cantos para enquadrar somente a pessoa ou roupa principal.</p></div><button onClick={handleCancelCrop} className="p-2 text-white/70"><X /></button></div><ReferenceCropper image={cropImage} onCropChange={setCropAreaPixels} /><button onClick={handleApplyCrop} disabled={cropping || !cropAreaPixels} className="w-full py-3 rounded-xl bg-[#E5D3A2] text-black font-bold uppercase disabled:opacity-40">{cropping ? "Preparando..." : "Aplicar recorte"}</button></div>}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">{children}</div>; }

function SingleSlot({ preview, onChange, onRecrop }: { preview: string | null; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onRecrop: () => void }) {
  if (!preview) return <label className="w-full h-64 rounded-3xl border-2 border-dashed border-[#E5D3A2]/50 bg-white/5 flex flex-col items-center justify-center p-6 text-center cursor-pointer"><input type="file" accept={REFERENCE_FILE_ACCEPT} onChange={onChange} className="hidden" /><ImagePlus size={32} className="text-[#E5D3A2] mb-3" /><span className="text-sm font-bold uppercase">Tirar foto ou escolher da galeria</span><span className="text-[11px] text-white/50">O recorte será enviado, não a foto original</span></label>;
  return <div className="w-full space-y-3"><PreviewImage src={preview} alt="Recorte do modelo" onRecrop={onRecrop} onChange={onChange} /><p className="text-[11px] text-center text-white/60">Apenas este recorte será enviado ao GPT-5 Vision.</p></div>;
}

function CompositeSlot({ label, preview, onChange, onRecrop }: { label: string; preview: string | null; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; onRecrop: () => void }) {
  return <div className="space-y-1.5 text-center"><span className="text-[10px] font-bold text-[#E5D3A2] uppercase tracking-wider flex items-center justify-center gap-1"><Layers size={12} /> {label}</span>{preview ? <PreviewImage src={preview} alt={label} onRecrop={onRecrop} onChange={onChange} compact /> : <label className="w-full h-44 rounded-2xl border-2 border-dashed border-[#E5D3A2]/40 bg-white/5 flex flex-col items-center justify-center p-3 cursor-pointer"><input type="file" accept={REFERENCE_FILE_ACCEPT} onChange={onChange} className="hidden" /><ImagePlus size={24} className="text-[#E5D3A2] mb-1" /><span className="text-[11px] font-bold uppercase">Selecionar da galeria</span></label>}</div>;
}

function PreviewImage({ src, alt, onRecrop, onChange, compact = false }: { src: string; alt: string; onRecrop: () => void; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void; compact?: boolean }) {
  return <div className={`relative rounded-2xl overflow-hidden border-2 border-[#E5D3A2] bg-black ${compact ? "h-44" : "aspect-3/4 max-h-72"}`}><img src={src} alt={alt} className="w-full h-full object-contain" /><div className="absolute top-2 right-2 flex gap-2"><button type="button" onClick={onRecrop} className="p-2 rounded-full bg-black/75 border border-white/20"><Crop size={14} /></button><label className="p-2 rounded-full bg-black/75 border border-white/20 cursor-pointer"><input type="file" accept={REFERENCE_FILE_ACCEPT} onChange={onChange} className="hidden" /><RefreshCw size={14} /></label></div></div>;
}
