import { Check, Pencil, Image, Palette, Sparkles } from "lucide-react";

const STEPS = [
  { key: "criar", label: "Criar", icon: Pencil },
  { key: "croqui", label: "Croqui", icon: Image },
  { key: "realista", label: "Realista", icon: Palette },
  { key: "resultado", label: "Resultado", icon: Sparkles },
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
          const Icon = step.icon;
          return (
            <div key={step.key} className="contents">
              <div className="stepper-step" data-state={state}>
                <span className="stepper-dot">
                  {state === "complete" ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <Icon size={13} strokeWidth={2.5} />
                  )}
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
