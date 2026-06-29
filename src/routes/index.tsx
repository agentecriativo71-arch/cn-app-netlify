import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Sparkles, QrCode, Pencil, Image, Palette, Zap, Shield, Wand2 } from "lucide-react";
import logo from "@/assets/logo.jpg";
import { useState, useEffect } from "react";
import { useLook } from "@/lib/store";
import { NomeModal } from "@/components/NomeModal";

export const Route = createFileRoute("/")(  {
  component: Home,
  head: () => ({
    meta: [
      { title: "C&N Tecidos — Agente Criativo" },
      { name: "description", content: "Crie seu look com o Crispim, a IA da C&N Tecidos. Croqui e foto realista em segundos." },
    ],
  }),
});

function Home() {
  const router = useRouter();
  const s = useLook();
  const [showNomeModal, setShowNomeModal] = useState(false);

  useEffect(() => {
    s.reset();
  }, []);

  const handleCriarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (s.nome) {
      router.navigate({ to: "/criar" });
    } else {
      setShowNomeModal(true);
    }
  };

  const handleConfirmNome = (nome: string) => {
    s.set({ nome });
    setShowNomeModal(false);
    router.navigate({ to: "/criar" });
  };
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-12 relative z-10 text-center select-none">
      {/* Top Header */}
      <header className="w-full mt-4 flex flex-col items-center gap-1.5">
        <span className="text-[12px] tracking-[0.3em] font-medium text-white/90 uppercase" style={{ fontFamily: "var(--font-display)" }}>
          CN TECIDOS
        </span>
      </header>

      {/* Main Title & Action */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-md w-full my-6 gap-8 sm:gap-10">
        {/* Sparkles / Stars decorative (mockup has small gold stars around title) */}
        <div className="relative">
          {/* Left Star */}
          <div className="absolute -top-6 -left-8 text-[#E5D3A2] opacity-80 animate-pulse text-lg">✦</div>
          {/* Right Star */}
          <div className="absolute top-2 -right-8 text-[#E5D3A2] opacity-80 animate-pulse text-sm">✦</div>
          {/* Left Lower Star */}
          <div className="absolute bottom-2 -left-10 text-[#E5D3A2] opacity-80 animate-pulse text-sm">✦</div>

          <h1 className="text-4.5xl sm:text-6xl font-extrabold leading-[1.1] text-[#E6DEC9] tracking-tight uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Gerador<br />
            de Croqui
          </h1>
        </div>

        <p className="text-[11px] sm:text-[13px] tracking-[0.18em] font-semibold text-white/90 max-w-xs uppercase leading-relaxed" style={{ fontFamily: "var(--font-display)" }}>
          Faça agora seu modelo na CN Tecidos!
        </p>

        {/* CTA Button with double outline container */}
        <div className="w-full max-w-sm px-4 mt-2">
          <div className="btn-double-border-container shadow-2xl">
            <button onClick={handleCriarClick} className="btn-double-border hover:bg-[#d1c295] active:scale-98 transition-all">
              Aperte para iniciar
            </button>
          </div>
        </div>

        {/* Sub-text: Receba pelo WhatsApp */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[13px] sm:text-[14px] tracking-[0.2em] font-semibold text-white/95 uppercase" style={{ fontFamily: "var(--font-display)" }}>
            Receba pelo WhatsApp
          </span>
        </div>

        {/* QR Code link preserved visually as elegant text link */}
        <Link to="/qr" className="text-[11px] sm:text-xs text-white/60 hover:text-white underline tracking-wider uppercase transition-colors">
          Abrir QR para celular
        </Link>
      </div>

      {/* Footer Info */}
      <footer className="w-full mt-auto flex flex-col items-center gap-1.5 text-white/70 text-[11px] sm:text-xs tracking-widest uppercase">
        <span className="font-medium text-white/80">Rua Juiz Acrísio Noves, 16</span>
        <a href="https://www.lojascrispim.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
          www.lojascrispim.com.br
        </a>
      </footer>

      <NomeModal
        open={showNomeModal}
        onClose={() => setShowNomeModal(false)}
        onConfirm={handleConfirmNome}
      />
    </main>
  );
}
