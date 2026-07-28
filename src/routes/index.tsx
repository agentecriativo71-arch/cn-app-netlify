import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState, useEffect, useLayoutEffect } from "react";
import { useLook } from "@/lib/store";
import { NomeModal } from "@/components/NomeModal";
import { useVideoStore } from "@/lib/videoStore";

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
  const { triggerTransition, transitionPhase, reset: resetVideo, setInitialLoading } = useVideoStore();
  const [showNomeModal, setShowNomeModal] = useState(false);
  // Sempre inicia como true (oculto). useLayoutEffect revela imediatamente no desktop
  // antes do 1º paint, evitando qualquer flash em produção (SSR/hidratação/code-split).
  const [isMobileLoading, setIsMobileLoading] = useState(true);

  useLayoutEffect(() => {
    // Desktop: revela imediatamente, antes do paint
    if (window.innerWidth >= 768) {
      setIsMobileLoading(false);
    }
  }, []);

  useEffect(() => {
    s.reset();
    resetVideo();

    // Apenas no mobile (largura < 768px), exibe tela de carregamento de 4s com o manequim caminhando em 100% qualidade
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setInitialLoading(true);
      triggerTransition(undefined, 4000); // 4s total de intro com vídeo
      // O conteúdo começa a surgir suavemente em 2.2s, antes da intro de 4s terminar
      const timer = setTimeout(() => {
        setIsMobileLoading(false);
        setInitialLoading(false);
      }, 2200);
      return () => {
        clearTimeout(timer);
        setInitialLoading(false);
      };
    }
  }, []);

  const goToCriar = () => {
    // Transição lenta e fluida de 4s
    triggerTransition(() => {
      router.navigate({ to: "/criar" });
    }, 4000);
  };

  const handleCriarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (s.nome) {
      goToCriar();
    } else {
      setShowNomeModal(true);
    }
  };

  const handleConfirmNome = (nome: string) => {
    s.set({ nome });
    setShowNomeModal(false);
    goToCriar();
  };

  const isExiting = transitionPhase === "exit";
  const hideContent = isExiting || isMobileLoading;

  return (
    <>
      {isMobileLoading && (
        <div className="fixed inset-0 z-20 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none transition-opacity duration-1000 ease-out">
          <span
            className="text-[11px] tracking-[0.35em] font-semibold text-[#E5D3A2] uppercase animate-pulse mb-3"
            style={{ fontFamily: "var(--font-display)" }}
          >
            CN TECIDOS
          </span>
          <h2
            className="text-2xl font-extrabold text-[#E6DEC9] tracking-tight uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Carregando...
          </h2>
        </div>
      )}
      <main className="min-h-screen max-md:min-h-[calc(100vh-1rem)] flex flex-col items-center justify-between max-md:justify-end px-5 pt-6 pb-4 max-md:pb-3 relative z-10 text-center select-none">
        {/* Main Title & Action — Card Glass elevado +100px (mb-[100px]) exclusivamente no Mobile */}
        <div
          className="w-full max-w-md my-auto max-md:my-0 max-md:mt-auto max-md:mb-[100px] flex flex-col items-center justify-center gap-7 sm:gap-10 max-md:bg-black/35 max-md:backdrop-blur-md max-md:p-6 max-md:rounded-3xl max-md:border max-md:border-white/15 max-md:shadow-2xl"
          style={{
            opacity: hideContent ? 0 : 1,
            transform: hideContent ? "translateY(24px) scale(0.96)" : "translateY(0) scale(1)",
            transition: "opacity 2s cubic-bezier(0.22, 1, 0.36, 1), transform 2s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <div className="relative">
            <div className="absolute -top-6 -left-8 text-[#E5D3A2] opacity-80 animate-pulse text-lg">✦</div>
            <div className="absolute top-2 -right-8 text-[#E5D3A2] opacity-80 animate-pulse text-sm">✦</div>
            <div className="absolute bottom-2 -left-10 text-[#E5D3A2] opacity-80 animate-pulse text-sm">✦</div>

            <h1
              className="text-4.5xl sm:text-6xl font-extrabold leading-[1.1] text-[#E6DEC9] tracking-tight uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Gerador<br />
              de Croqui
            </h1>
          </div>

          <p
            className="text-[11px] sm:text-[13px] tracking-[0.18em] font-semibold text-white/95 max-w-xs uppercase leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Faça agora seu modelo na<br />
            <strong className="font-extrabold text-[#E6DEC9] text-[12px] sm:text-[14px]">CN TECIDOS!</strong>
          </p>

          {/* CTA Button with double outline container */}
          <div className="w-full max-w-sm px-4 mt-1">
            <div className="btn-double-border-container shadow-2xl">
              <button onClick={handleCriarClick} className="btn-double-border hover:bg-[#d1c295] active:scale-98 transition-all">
                Aperte para iniciar
              </button>
            </div>
          </div>

          {/* Sub-text: Receba pelo WhatsApp */}
          <div className="flex flex-col items-center gap-1">
            <span
              className="text-[13px] sm:text-[14px] tracking-[0.2em] font-semibold text-white uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              Receba pelo WhatsApp
            </span>
          </div>

          {/* QR Code link — mantido apenas no Desktop */}
          <Link
            to="/qr"
            className="hidden md:inline-block text-[11px] sm:text-xs text-white/70 hover:text-white underline tracking-wider uppercase transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
          >
            Abrir QR para celular
          </Link>
        </div>

        <NomeModal
          open={showNomeModal}
          onClose={() => setShowNomeModal(false)}
          onConfirm={handleConfirmNome}
        />
      </main>

      {/* Footer Info — Posicionado abaixo da dobra inicial do mobile */}
      <footer className="w-full pt-14 pb-6 flex flex-col items-center gap-1.5 text-white/70 text-[11px] sm:text-xs tracking-widest uppercase relative z-10">
        <span className="font-medium text-white/80">Rua Juiz Acrísio Noves, 16</span>
        <a href="https://www.lojascrispim.com.br" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
          www.lojascrispim.com.br
        </a>
      </footer>
    </>
  );
}
