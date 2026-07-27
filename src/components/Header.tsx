import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.jpg";

export function Header({ title, back = "/" }: { title: string; back?: string }) {
  const router = useRouter();
  return (
    <header
      className="sticky top-0 z-30 shadow-sm"
      style={{
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(16px) saturate(1.6)",
        WebkitBackdropFilter: "blur(16px) saturate(1.6)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
      }}
    >
      <div className="container-wide flex items-center h-8 sm:h-9 px-3">
        <button
          onClick={() => (back ? router.navigate({ to: back }) : router.history.back())}
          className="p-1 -ml-1 rounded-lg transition-all hover:bg-white/10 active:scale-95"
          style={{ color: "var(--color-primary)" }}
          aria-label="Voltar"
        >
          <ArrowLeft size={16} />
        </button>
        <h1
          className="flex-1 text-center truncate px-2"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--color-primary)",
            letterSpacing: "0.02em",
          }}
        >
          {title}
        </h1>
        <Link to="/" className="flex items-center gap-1.5 shrink-0 hover:opacity-90 transition-opacity">
          <img
            src={logo}
            alt="C&N Tecidos"
            className="w-5 h-5 rounded-md object-cover border border-white/20"
          />
          <span
            className="text-[10px] font-bold tracking-wider"
            style={{ fontFamily: "var(--font-display)", color: "var(--color-secondary)" }}
          >
            C&amp;N
          </span>
        </Link>
      </div>
    </header>
  );
}
