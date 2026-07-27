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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isTransitioning) {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else {
      try {
        video.pause();
      } catch (_) {}
    }
  }, [isTransitioning]);

  return (
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
        className="absolute top-0 right-0 h-full w-auto max-w-none opacity-35 translate-x-[45%] md:opacity-100 md:translate-x-1/4"
        style={{
          mixBlendMode: "screen",
          maskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 25%, black 100%)",
        }}
      />
    </div>
  );
}
