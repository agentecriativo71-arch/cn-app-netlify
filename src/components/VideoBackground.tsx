import { useRef, useEffect } from "react";
import { useVideoStore } from "@/lib/videoStore";
import videoSrc from "@/assets/video.mp4";

/**
 * VideoBackground
 *
 * Na tela inicial (isHomeIdle), o vídeo do manequim roda continuamente em
 * opacidade cheia, sem véu — pensado para totem, atraindo atenção enquanto
 * ninguém interagiu ainda. Nas transições internas (entre etapas do
 * formulário), o vídeo também aparece em opacidade cheia, mas recebe um véu
 * escuro por cima para não quebrar o contraste do design daquelas telas.
 * Em repouso fora da home (idle dentro do fluxo), o vídeo fica oculto.
 */
export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isTransitioning = useVideoStore((s) => s.isTransitioning);
  const isInitialLoading = useVideoStore((s) => s.isInitialLoading);
  const isHomeIdle = useVideoStore((s) => s.isHomeIdle);

  const transitionPhase = useVideoStore((s) => s.transitionPhase);
  const transitionMessage = useVideoStore((s) => s.transitionMessage);

  const isVideoActive = isTransitioning || isInitialLoading || isHomeIdle;
  // Véu escuro aplicado apenas nas transições internas (não na home idle).
  const showDarkVeil = isTransitioning && !isHomeIdle;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isVideoActive) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else {
      try {
        video.pause();
      } catch (_) {}
    }
  }, [isVideoActive]);

  // Se a fase for 'enter' ou 'idle', queremos que a mensagem desapareça.
  const showMessage = transitionMessage !== null && transitionPhase === "exit";

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
          preload="auto"
          className={`absolute top-0 right-0 h-full w-auto max-w-none translate-x-[45%] md:translate-x-1/4 transition-opacity duration-700 ease-in-out ${
            isVideoActive ? "opacity-100" : "opacity-0"
          }`}
          style={{
            mixBlendMode: "screen",
            maskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
          }}
        />
        {/* Véu escuro sobre o vídeo, apenas nas transições internas */}
        <div
          className="absolute inset-0 transition-opacity duration-700 ease-in-out"
          style={{
            background: "#000000",
            opacity: showDarkVeil ? 0.3 : 0,
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
