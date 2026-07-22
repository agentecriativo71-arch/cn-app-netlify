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
            <span className="coach-card-icon">💡</span>
            <h4 className="coach-card-title">Dica</h4>
            <button
              className="coach-card-close"
              onClick={closeBubble}
              type="button"
              aria-label="Fechar dica"
            >
              ×
            </button>
          </div>

          <p className="coach-card-text">{currentTutorial.bubbleText}</p>

          <button
            className="coach-card-review"
            onClick={reviewTutorial}
            type="button"
          >
            🔄 Rever tutorial completo
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
        <span className="coach-bubble-icon">💡</span>
      </button>
    </>
  );
}
