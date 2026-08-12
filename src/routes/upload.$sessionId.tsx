// ROTA PÚBLICA — não adicionar auth guard aqui
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { pollUploadSessionFn, uploadCroquiFileFn } from "@/server/api";
import { Upload, CheckCircle2, Loader2, ImagePlus, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/upload/$sessionId")({
  component: UploadCroquiMobile,
  head: () => ({
    meta: [
      { title: "Enviar Croqui — C&N Tecidos" },
      { name: "description", content: "Envie a foto do seu croqui para a C&N Tecidos" },
    ],
  }),
});

function UploadCroquiMobile() {
  const { sessionId } = Route.useParams();
  const [nomeCliente, setNomeCliente] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("loading");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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
        setStatus("ready"); // fallback para permitir upload mesmo se poll falhar
      }
    }
    loadSession();
  }, [sessionId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    setErrorMsg(null);
    setSelectedFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile || !previewUrl) return;

    setUploading(true);
    setErrorMsg(null);

    try {
      await uploadCroquiFileFn({
        data: {
          sessionId,
          fileBase64: previewUrl,
          fileName: selectedFile.name || "croqui.jpg",
        },
      });
      setStatus("success");
    } catch (err) {
      console.error("[UPLOAD] Error:", err);
      setErrorMsg("Ocorreu uma falha ao enviar o croqui. Por favor, tente novamente.");
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
          Esta sessão de envio de croqui expirou ou não existe mais. Por favor, solicite um novo QR Code no totem.
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
            Croqui Enviado!
          </h2>
          <p className="text-sm text-white/80 max-w-xs mx-auto">
            {nomeCliente ? `Obrigado, ${nomeCliente}! ` : ""}Sua foto foi recebida com sucesso. O totem continuará automaticamente.
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-white/60 max-w-xs">
          ✨ Olhe para a tela do totem para continuar criando seu look.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between p-5 select-none">
      {/* Top Header */}
      <header className="text-center pt-4 pb-2 space-y-1 border-b border-white/10">
        <span className="text-[10px] tracking-[0.35em] font-semibold text-[#E5D3A2] uppercase">
          CN TECIDOS
        </span>
        <h1 className="text-xl font-extrabold text-[#E6DEC9] uppercase tracking-tight">
          Enviar Meu Croqui
        </h1>
        {nomeCliente && (
          <p className="text-xs text-white/60">Cliente: <span className="text-white font-semibold">{nomeCliente}</span></p>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center py-6 space-y-6">
        {!previewUrl ? (
          <label className="w-full max-w-xs h-64 rounded-3xl border-2 border-dashed border-[#E5D3A2]/50 bg-white/5 hover:bg-white/10 active:scale-98 transition-all flex flex-col items-center justify-center p-6 text-center cursor-pointer shadow-xl group">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="w-16 h-16 rounded-2xl bg-[#E5D3A2]/20 flex items-center justify-center text-[#E5D3A2] mb-3 group-hover:scale-110 transition-transform">
              <ImagePlus size={32} />
            </div>
            <span className="text-sm font-bold text-white uppercase tracking-wider mb-1">
              Tirar foto ou escolher arquivo
            </span>
            <span className="text-[11px] text-white/50">
              Selecione o croqui do seu celular
            </span>
          </label>
        ) : (
          <div className="w-full max-w-xs space-y-4 fade-in">
            <div className="relative rounded-2xl overflow-hidden border-2 border-[#E5D3A2] shadow-2xl bg-black aspect-3/4 flex items-center justify-center">
              <img src={previewUrl} alt="Preview do croqui" className="w-full h-full object-contain" />
              <label className="absolute top-3 right-3 p-2.5 rounded-full bg-black/70 border border-white/20 text-white cursor-pointer active:scale-95 transition-all">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <RefreshCw size={16} />
              </label>
            </div>
            <p className="text-xs text-center text-white/60">
              Confira se a imagem está nítida antes de enviar.
            </p>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs text-center max-w-xs">
            {errorMsg}
          </div>
        )}
      </main>

      {/* Footer / Submit Button */}
      <footer className="pb-4">
        <button
          onClick={handleUploadSubmit}
          disabled={!previewUrl || uploading}
          className="w-full py-4 rounded-2xl bg-[#E5D3A2] text-black font-extrabold uppercase tracking-wider text-sm shadow-xl hover:bg-[#d1c295] active:scale-98 transition-all disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Enviando croqui...
            </>
          ) : (
            <>
              <Upload size={18} /> Confirmar e Enviar
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
