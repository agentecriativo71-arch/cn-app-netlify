// ROTA PÚBLICA — não adicionar auth guard aqui
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pollUploadSessionFn, uploadReferenceFilesFn } from "@/server/api";
import { Upload, CheckCircle2, Loader2, ImagePlus, RefreshCw, Layers, Sparkles } from "lucide-react";

export const Route = createFileRoute("/upload/$sessionId")({
  component: UploadModeloMobile,
  head: () => ({
    meta: [
      { title: "Enviar Modelo de Referência — C&N Tecidos" },
      { name: "description", content: "Envie fotos de referência do seu look para a C&N Tecidos" },
    ],
  }),
});

function UploadModeloMobile() {
  const { sessionId } = Route.useParams();
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("loading");

  // Modo: "single" (1 foto geral) ou "composite" (2 fotos: cima + baixo)
  const [mode, setMode] = useState<"single" | "composite">("single");

  // Estados Foto Única
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singlePreview, setSinglePreview] = useState<string | null>(null);

  // Estados Foto Dupla
  const [topFile, setTopFile] = useState<File | null>(null);
  const [topPreview, setTopPreview] = useState<string | null>(null);
  const [bottomFile, setBottomFile] = useState<File | null>(null);
  const [bottomPreview, setBottomPreview] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSession() {
      try {
        const res = await pollUploadSessionFn({ data: { sessionId } });
        if (res.session) {
          setNomeCliente(res.session.nome_cliente || null);
          if (res.session.status === "uploaded") {
            setStatus("already_uploaded");
          } else {
            setStatus("ready");
          }
        } else {
          setStatus("invalid");
        }
      } catch (err) {
        console.error("[UPLOAD SESS] Error:", err);
        setStatus("ready");
      }
    }
    loadSession();
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: "single" | "top" | "bottom") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      if (target === "single") {
        setSingleFile(file);
        setSinglePreview(b64);
      } else if (target === "top") {
        setTopFile(file);
        setTopPreview(b64);
      } else if (target === "bottom") {
        setBottomFile(file);
        setBottomPreview(b64);
      }
    };
    reader.readAsDataURL(file);
  };

  const isReadyToSubmit = mode === "single"
    ? !!singlePreview
    : !!topPreview && !!bottomPreview;

  const handleUploadSubmit = async () => {
    if (!isReadyToSubmit) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      if (mode === "single") {
        await uploadReferenceFilesFn({
          data: {
            sessionId,
            mode: "single",
            singleFileBase64: singlePreview,
          },
        });
      } else {
        await uploadReferenceFilesFn({
          data: {
            sessionId,
            mode: "composite",
            topFileBase64: topPreview,
            bottomFileBase64: bottomPreview,
          },
        });
      }
      setStatus("success");
    } catch (err) {
      console.error("[UPLOAD] Error:", err);
      setErrorMsg("Ocorreu uma falha ao processar as imagens de referência. Por favor, tente novamente.");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={32} className="animate-spin text-[#E5D3A2] mb-3" />
        <p className="text-sm font-medium text-white/70">Carregando sessão de upload...</p>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40">
          ✕
        </div>
        <h2 className="text-xl font-bold text-white">Sessão Inválida ou Expirada</h2>
        <p className="text-xs text-white/60 max-w-xs">
          Esta sessão de envio expirou ou não existe mais. Solicite um novo QR Code no totem.
        </p>
      </div>
    );
  }

  if (status === "success" || status === "already_uploaded") {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex flex-col items-center justify-center p-6 text-center space-y-5 fade-in">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 animate-bounce">
          <CheckCircle2 size={48} />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] tracking-[0.3em] font-semibold text-[#E5D3A2] uppercase">
            C&N TECIDOS
          </span>
          <h2 className="text-2xl font-extrabold text-white uppercase tracking-tight">
            Modelo Recebido!
          </h2>
          <p className="text-sm text-white/80 max-w-xs mx-auto">
            {nomeCliente ? `Obrigado, ${nomeCliente}! ` : ""}As fotos foram analisadas pela IA e o croqui técnico foi gerado com sucesso.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/60 max-w-xs">
          ✨ Olhe para a tela do totem para continuar visualizando seu look.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between p-4 sm:p-6 select-none max-w-md mx-auto">
      {/* Top Header */}
      <header className="text-center pt-2 pb-3 space-y-1 border-b border-white/10">
        <span className="text-[10px] tracking-[0.35em] font-semibold text-[#E5D3A2] uppercase">
          CN TECIDOS
        </span>
        <h1 className="text-xl font-extrabold text-[#E6DEC9] uppercase tracking-tight">
          Enviar Foto de Referência
        </h1>
        {nomeCliente && (
          <p className="text-xs text-white/60">Cliente: <span className="text-white font-semibold">{nomeCliente}</span></p>
        )}
      </header>

      {/* Mode Selector Tabs */}
      <div className="pt-3">
        <div className="grid grid-cols-2 p-1 rounded-2xl bg-white/5 border border-white/10">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              mode === "single"
                ? "bg-[#E5D3A2] text-black shadow-lg"
                : "text-white/60 hover:text-white"
            }`}
          >
            1 Foto Geral
          </button>
          <button
            type="button"
            onClick={() => setMode("composite")}
            className={`py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all ${
              mode === "composite"
                ? "bg-[#E5D3A2] text-black shadow-lg"
                : "text-white/60 hover:text-white"
            }`}
          >
            2 Fotos (Cima + Baixo)
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center py-4 space-y-4">
        {mode === "single" ? (
          /* MODO FOTO ÚNICA */
          <div className="w-full space-y-3">
            <p className="text-xs text-center text-white/70">
              Envie a foto do modelo que você gostou (foto no espelho, passarela, print de rede social, etc.)
            </p>
            {!singlePreview ? (
              <label className="w-full h-64 rounded-3xl border-2 border-dashed border-[#E5D3A2]/50 bg-white/5 hover:bg-white/10 active:scale-98 transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer shadow-xl group">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, "single")}
                  className="hidden"
                />
                <div className="w-16 h-16 rounded-2xl bg-[#E5D3A2]/20 flex items-center justify-center text-[#E5D3A2] mb-3 group-hover:scale-110 transition-transform">
                  <ImagePlus size={32} />
                </div>
                <span className="text-sm font-bold text-white uppercase tracking-wider mb-1">
                  Tirar foto ou escolher arquivo
                </span>
                <span className="text-[11px] text-white/50">
                  Selecione a foto do modelo do celular
                </span>
              </label>
            ) : (
              <div className="w-full space-y-3 fade-in">
                <div className="relative rounded-2xl overflow-hidden border-2 border-[#E5D3A2] shadow-2xl bg-black aspect-3/4 max-h-72 mx-auto flex items-center justify-center">
                  <img src={singlePreview} alt="Preview do modelo" className="w-full h-full object-contain" />
                  <label className="absolute top-3 right-3 p-2.5 rounded-full bg-black/70 border border-white/20 text-white cursor-pointer active:scale-95 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => handleFileChange(e, "single")}
                      className="hidden"
                    />
                    <RefreshCw size={16} />
                  </label>
                </div>
                <p className="text-[11px] text-center text-white/60">
                  A IA analisará a silhueta e gerará o croqui técnico limpo.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* MODO FOTO DUPLA (CIMA + BAIXO) */
          <div className="w-full space-y-4">
            <p className="text-xs text-center text-white/70">
              Combine a parte superior de um vestido com a saia de outro. A IA unificará as duas partes!
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Slot 1: Parte de Cima */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-[#E5D3A2] uppercase tracking-wider flex items-center justify-center gap-1">
                  <Layers size={12} /> 1. Busto / Cima
                </span>
                {!topPreview ? (
                  <label className="w-full h-44 rounded-2xl border-2 border-dashed border-[#E5D3A2]/40 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "top")}
                      className="hidden"
                    />
                    <ImagePlus size={24} className="text-[#E5D3A2] mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-white uppercase">Decote / Manga</span>
                    <span className="text-[9px] text-white/50">Foto da parte superior</span>
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-[#E5D3A2] h-44 bg-black flex items-center justify-center">
                    <img src={topPreview} alt="Parte de cima" className="w-full h-full object-cover" />
                    <label className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/20 text-white cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "top")}
                        className="hidden"
                      />
                      <RefreshCw size={12} />
                    </label>
                  </div>
                )}
              </div>

              {/* Slot 2: Parte de Baixo */}
              <div className="space-y-1.5 text-center">
                <span className="text-[10px] font-bold text-[#E5D3A2] uppercase tracking-wider flex items-center justify-center gap-1">
                  <Layers size={12} /> 2. Saia / Baixo
                </span>
                {!bottomPreview ? (
                  <label className="w-full h-44 rounded-2xl border-2 border-dashed border-[#E5D3A2]/40 bg-white/5 hover:bg-white/10 transition-all flex flex-col items-center justify-center p-3 text-center cursor-pointer group">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleFileChange(e, "bottom")}
                      className="hidden"
                    />
                    <ImagePlus size={24} className="text-[#E5D3A2] mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-white uppercase">Saia / Cauda</span>
                    <span className="text-[9px] text-white/50">Foto da parte inferior</span>
                  </label>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden border border-[#E5D3A2] h-44 bg-black flex items-center justify-center">
                    <img src={bottomPreview} alt="Parte de baixo" className="w-full h-full object-cover" />
                    <label className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 border border-white/20 text-white cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "bottom")}
                        className="hidden"
                      />
                      <RefreshCw size={12} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs text-center w-full">
            {errorMsg}
          </div>
        )}
      </main>

      {/* Footer / Submit Button */}
      <footer className="pb-2 pt-2">
        <button
          onClick={handleUploadSubmit}
          disabled={!isReadyToSubmit || uploading}
          className="w-full py-4 rounded-2xl bg-[#E5D3A2] text-black font-extrabold uppercase tracking-wider text-sm shadow-xl hover:bg-[#d1c295] active:scale-98 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Analisando e gerando croqui...
            </>
          ) : (
            <>
              <Sparkles size={18} /> Sintetizar e Enviar ao Totem
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
