import { Check } from "lucide-react";

const STEPS = [
  { key: "criar", label: "Criar" },
  { key: "croqui", label: "Croqui" },
  { key: "realista", label: "Realista" },
  { key: "resultado", label: "Resultado" },
] as const;

export type StepKey = (typeof STEPS)[number]["key"];

export function Stepper({ current }: { current: StepKey }) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <nav className="container-app px-5 py-3" aria-label="Progresso">
      <div className="stepper">
        {STEPS.map((step, i) => {
          const state =
            i < currentIdx ? "complete" : i === currentIdx ? "current" : "upcoming";
          return (
            <div key={step.key} className="contents">
              <div className="stepper-step" data-state={state}>
                <span className="stepper-dot">
                  {state === "complete" ? <Check size={12} strokeWidth={3} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className="stepper-line"
                  data-filled={i < currentIdx ? "true" : undefined}
                />
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
