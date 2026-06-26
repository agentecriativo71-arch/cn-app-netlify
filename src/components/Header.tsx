import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.jpg";

export function Header({ title, back = "/" }: { title: string; back?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20" style={{
      background: "oklch(1 0 0 / 0.8)",
      backdropFilter: "blur(20px) saturate(1.4)",
      WebkitBackdropFilter: "blur(20px) saturate(1.4)",
      borderBottom: "1px solid oklch(0.42 0.12 160 / 0.06)"
    }}>
      <div className="container-wide flex items-center h-14 px-4 sm:h-16">
        <button
          onClick={() => (back ? router.navigate({ to: back }) : router.history.back())}
          className="p-2 -ml-2 rounded-xl transition-all"
          style={{ color: "var(--color-primary)" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1
          className="flex-1 text-center truncate px-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "17px",
            fontWeight: 600,
            color: "var(--color-primary)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h1>
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={logo}
            alt="C&N Tecidos"
            className="hidden sm:block w-7 h-7 rounded-lg object-cover"
          />
          <span
            className="text-xs font-bold tracking-wider"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-secondary)" }}
          >
            C&amp;N
          </span>
        </Link>
      </div>
      {/* Gradient accent line */}
      <div className="h-[2px]" style={{ background: "linear-gradient(90deg, transparent, oklch(0.42 0.12 160 / 0.2), oklch(0.72 0.13 75 / 0.15), transparent)" }} />
    </header>
  );
}
