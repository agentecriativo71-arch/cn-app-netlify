import { useRef, useEffect } from "react";
import { useVideoStore } from "@/lib/videoStore";
import videoSrc from "@/assets/video.mp4";

/**
 * VideoBackground
 *
 * Vídeo background ativo APENAS durante as transições de 3 segundos entre telas.
 * Em repouso (idle), o vídeo fica oculto (opacity 0) e pausado.
 * Durante a transição, surge com fade suave, roda em movimento e desvanece elegantemente.
 */
export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isTransitioning = useVideoStore((s) => s.isTransitioning);
  const isInitialLoading = useVideoStore((s) => s.isInitialLoading);

  const transitionPhase = useVideoStore((s) => s.transitionPhase);
  const transitionMessage = useVideoStore((s) => s.transitionMessage);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isTransitioning || isInitialLoading) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else {
      try {
        video.pause();
      } catch (_) {}
    }
  }, [isTransitioning, isInitialLoading]);

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
            isInitialLoading ? "opacity-100" : "opacity-35 md:opacity-100"
          }`}
          style={{
            mixBlendMode: "screen",
            maskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
            WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
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
