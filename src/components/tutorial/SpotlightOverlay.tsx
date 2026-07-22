import { useCallback, useEffect, useRef, useState } from "react";
import { useTutorial } from "./TutorialProvider";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const PADDING = 8;
const BORDER_RADIUS = 16;

export function SpotlightOverlay() {
  const {
    spotlightActive,
    spotlightStepIndex,
    currentTutorial,
    nextStep,
    skipSpotlight,
  } = useTutorial();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<"top" | "bottom">("bottom");
  const overlayRef = useRef<HTMLDivElement>(null);

  const updateTargetRect = useCallback(() => {
    if (!currentTutorial || !spotlightActive) return;

    const step = currentTutorial.steps[spotlightStepIndex];
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setTargetRect({
      top: rect.top - PADDING,
      left: rect.left - PADDING,
      width: rect.width + PADDING * 2,
      height: rect.height + PADDING * 2,
    });

    // Decide posição do tooltip
    if (step.tooltipPosition && step.tooltipPosition !== "auto") {
      setTooltipPosition(step.tooltipPosition);
    } else {
      const spaceBelow = window.innerHeight - rect.bottom;
      setTooltipPosition(spaceBelow > 220 ? "bottom" : "top");
    }
  }, [currentTutorial, spotlightActive, spotlightStepIndex]);

  useEffect(() => {
    if (!spotlightActive) return;

    updateTargetRect();

    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [spotlightActive, spotlightStepIndex, updateTargetRect]);

  // Scroll element into view
  useEffect(() => {
    if (!spotlightActive || !currentTutorial) return;
    const step = currentTutorial.steps[spotlightStepIndex];
    if (!step) return;

    const el = document.querySelector(step.targetSelector);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Re-calc after scroll
      setTimeout(updateTargetRect, 400);
    }
  }, [spotlightActive, spotlightStepIndex, currentTutorial, updateTargetRect]);

  if (!spotlightActive || !currentTutorial || !targetRect) return null;

  const step = currentTutorial.steps[spotlightStepIndex];
  if (!step) return null;

  const totalSteps = currentTutorial.steps.length;
  const isLastStep = spotlightStepIndex === totalSteps - 1;

  // Calcula posição do tooltip
  const tooltipStyle: React.CSSProperties =
    tooltipPosition === "bottom"
      ? {
          top: targetRect.top + targetRect.height + 16,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
        }
      : {
          bottom: window.innerHeight - targetRect.top + 16,
          left: Math.max(16, Math.min(targetRect.left, window.innerWidth - 320)),
        };

  return (
    <div ref={overlayRef} className="spotlight-overlay" data-testid="spotlight-overlay">
      {/* Overlay escuro com "buraco" */}
      <div
        className="spotlight-hole"
        style={{
          top: targetRect.top,
          left: targetRect.left,
          width: targetRect.width,
          height: targetRect.height,
          borderRadius: BORDER_RADIUS,
        }}
      />

      {/* Borda brilhante ao redor do highlight */}
      <div
        className="spotlight-ring"
        style={{
          top: targetRect.top - 2,
          left: targetRect.left - 2,
          width: targetRect.width + 4,
          height: targetRect.height + 4,
          borderRadius: BORDER_RADIUS + 2,
        }}
      />

      {/* Tooltip */}
      <div
        className="spotlight-tooltip"
        style={tooltipStyle}
        data-testid="spotlight-tooltip"
      >
        <div className="spotlight-tooltip-header">
          <span className="spotlight-tooltip-icon">💡</span>
          <h4 className="spotlight-tooltip-title">{step.title}</h4>
          {totalSteps > 1 && (
            <span className="spotlight-tooltip-counter">
              {spotlightStepIndex + 1}/{totalSteps}
            </span>
          )}
        </div>

        <p className="spotlight-tooltip-text">{step.text}</p>

        <div className="spotlight-tooltip-actions">
          <button
            className="spotlight-btn-skip"
            onClick={skipSpotlight}
            type="button"
          >
            Pular
          </button>
          <button
            className="spotlight-btn-next"
            onClick={nextStep}
            type="button"
          >
            {isLastStep ? "Entendi ✨" : "Próximo →"}
          </button>
        </div>
      </div>
    </div>
  );
}
