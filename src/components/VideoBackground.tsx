import { useRef, useEffect } from "react";
import { useVideoStore } from "@/lib/videoStore";
import videoSrc from "@/assets/video.mp4";

/**
 * VideoBackground
 *
 * O vídeo do manequim fica sempre visível e rodando, em qualquer tela e
 * qualquer dispositivo — sem depender de mix-blend-mode. Um véu escuro
 * simples (sem blend mode) fica sempre por cima, um pouco mais forte
 * durante as transições internas do formulário para preservar contraste,
 * e um pouco mais leve fora delas. Essa escolha evita a combinação
 * mix-blend-mode + PNG de alpha parcial + backdrop-filter dos cards, que
 * é uma área de composição historicamente inconsistente entre engines
 * (Blink/Chrome vs. WebKit/Safari) — com opacidade direta, a aparência
 * fica idêntica em qualquer navegador.
 */
export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isTransitioning = useVideoStore((s) => s.isTransitioning);
  const transitionMessage = useVideoStore((s) => s.transitionMessage);
  const messageVisible = useVideoStore((s) => s.messageVisible);

  const showMessage = transitionMessage !== null && messageVisible;
  // Véu um pouco mais forte durante transições internas (com mensagem
  // flutuando por cima), um pouco mais leve em repouso.
  const isDimmed = isTransitioning || showMessage;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, []);

  return (
    <>
      <div
        data-testid="video-background-container"
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        aria-hidden="true"
      >
        <video
          ref={videoRef}
          data-testid="video-background"
          src={videoSrc}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
          className="absolute top-0 right-0 h-full w-auto max-w-none translate-x-[45%] md:translate-x-1/4"
          style={{
            maskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
          }}
        />
        {/* Véu escuro fixo, sempre presente, sem blend mode — garante a
            mesma aparência "escurecida" em qualquer navegador/dispositivo. */}
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{
            background: "#000000",
            opacity: isDimmed ? 0.55 : 0.4,
          }}
        />
      </div>

      {/* Overlay da Mensagem de Transição */}
      <div
        className="fixed inset-0 z-20 pointer-events-none flex flex-col items-center justify-center p-6 text-center select-none"
        style={{
          opacity: showMessage ? 1 : 0,
          transform: showMessage ? "translateY(0) scale(1)" : "translateY(16px) scale(0.95)",
          transition: "opacity 400ms ease-in-out, transform 400ms ease-in-out",
          transitionDelay: showMessage ? "150ms" : "0s",
        }}
      >
        {transitionMessage && (
          <div className="flex flex-col items-center justify-center gap-4 max-w-md bg-black/40 backdrop-blur-md p-8 rounded-3xl border border-white/10 shadow-2xl">
            <h2
              className="text-2xl sm:text-3xl font-bold text-[#E6DEC9] tracking-tight"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {transitionMessage.title}
            </h2>
            <p className="text-[#E6DEC9]/70 text-sm font-medium">
              {transitionMessage.subtitle}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
