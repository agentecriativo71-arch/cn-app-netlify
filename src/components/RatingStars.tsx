import { useState } from "react";
import { Star } from "lucide-react";
import { rateArtifactFn } from "@/server/api";

type RatingStarsProps = {
  artifactId: string | null;
  executionId: string | null;
  label?: string;
};

export function RatingStars({ artifactId, executionId, label = "Avalie este resultado" }: RatingStarsProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!artifactId) return null;

  const submit = async (score: number) => {
    if (saving) return;
    setSaving(true);
    setMessage(null);
    try {
      await rateArtifactFn({ data: { artifactId, executionId: executionId || undefined, score } });
      setRating(score);
      setMessage("Obrigado pela avaliação!");
    } catch {
      setMessage("Não foi possível salvar sua avaliação. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const visibleRating = hovered || rating || 0;
  return (
    <div className="card-soft" aria-label={label}>
      <p className="text-xs font-semibold mb-2" style={{ color: "var(--color-muted-foreground)" }}>{label}</p>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            disabled={saving}
            aria-label={`${score} estrela${score === 1 ? "" : "s"}`}
            className="p-1 rounded-md transition-transform hover:scale-110 disabled:opacity-50"
            onMouseEnter={() => setHovered(score)}
            onFocus={() => setHovered(score)}
            onBlur={() => setHovered(null)}
            onClick={() => submit(score)}
          >
            <Star size={22} fill={score <= visibleRating ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ))}
        {rating && <span className="text-xs ml-2 text-white/70">{rating}/5</span>}
      </div>
      {message && <p className="text-xs mt-2 text-white/65" role="status">{message}</p>}
    </div>
  );
}
