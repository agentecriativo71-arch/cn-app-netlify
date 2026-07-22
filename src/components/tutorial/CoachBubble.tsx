import { Lightbulb, RotateCcw, X } from "lucide-react";
import { useTutorial } from "./TutorialProvider";

export function CoachBubble() {
  const {
    activeScreen,
    spotlightActive,
    bubbleOpen,
    currentTutorial,
    toggleBubble,
    closeBubble,
    reviewTutorial,
  } = useTutorial();

  // Não renderiza se não há tela ativa, se spotlight tá rolando, ou se não tem tutorial
  if (!activeScreen || spotlightActive || !currentTutorial) return null;

  return (
    <>
      {/* Backdrop ao expandir */}
      {bubbleOpen && (
        <div
          className="coach-backdrop"
          onClick={closeBubble}
          data-testid="coach-backdrop"
        />
      )}

      {/* Card expandido */}
      {bubbleOpen && (
        <div className="coach-card" data-testid="coach-card">
          <div className="coach-card-header">
            <div className="p-1.5 rounded-lg bg-[#FFE600]/20 text-[#FFE600] flex items-center justify-center">
              <Lightbulb size={18} className="animate-pulse" />
            </div>
            <h4 className="coach-card-title">Dica Rápida</h4>
            <button
              className="coach-card-close"
              onClick={closeBubble}
              type="button"
              aria-label="Fechar dica"
            >
              <X size={16} />
            </button>
          </div>

          <p className="coach-card-text">{currentTutorial.bubbleText}</p>

          <button
            className="coach-card-review flex items-center justify-center gap-1.5"
            onClick={reviewTutorial}
            type="button"
          >
            <RotateCcw size={13} /> Rever tutorial completo
          </button>
        </div>
      )}

      {/* Bolha flutuante */}
      <button
        className="coach-bubble"
        onClick={toggleBubble}
        type="button"
        aria-label="Abrir dica da tela"
        data-testid="coach-bubble"
        data-open={bubbleOpen || undefined}
      >
        <span className="coach-bubble-icon">
          <Lightbulb size={24} className="text-[#FFE866] drop-shadow-[0_0_10px_rgba(255,232,102,0.8)] fill-[#FFE866]/30 animate-pulse" />
        </span>
      </button>
    </>
  );
}
