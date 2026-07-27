import { useRef, useEffect } from "react";
import videoSrc from "@/assets/video.mp4";

/**
 * VideoBackground
 *
 * Vídeo em loop contínuo como background imersivo da aplicação.
 * Sempre rodando, sempre vivo — cria movimento ambiente em todas as telas.
 * A lógica de checkpoint do videoStore continua avançando o currentTime
 * nas transições, mas o loop garante movimento constante.
 */
export function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Garante autoplay mesmo em navegadores mais restritivos
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }, []);

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
        autoPlay
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
        style={{ mixBlendMode: "overlay" }}
      />
      {/* Overlay verde-esmeralda para manter a identidade da marca */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 30%, rgba(3,102,53,0.55) 0%, rgba(2,42,26,0.75) 100%)",
        }}
      />
    </div>
  );
}

