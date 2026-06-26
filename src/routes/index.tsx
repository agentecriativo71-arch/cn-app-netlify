import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Sparkles, QrCode, Pencil, Image, Palette, Zap, Shield, Wand2 } from "lucide-react";
import logo from "@/assets/logo.jpg";
import { useState } from "react";
import { useLook } from "@/lib/store";
import { NomeModal } from "@/components/NomeModal";

export const Route = createFileRoute("/")(  {
  component: Home,
  head: () => ({
    meta: [
      { title: "C&N Tecidos — Agente Criativo" },
      { name: "description", content: "Crie seu look com o Crispim, a IA da C&N Tecidos. Croqui e foto realista em segundos." },
    ],
  }),
});

function Home() {
  const router = useRouter();
  const s = useLook();
  const [showNomeModal, setShowNomeModal] = useState(false);

  const handleCriarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (s.nome) {
      router.navigate({ to: "/criar" });
    } else {
      setShowNomeModal(true);
    }
  };

  const handleConfirmNome = (nome: string) => {
    s.set({ nome });
    setShowNomeModal(false);
    router.navigate({ to: "/criar" });
  };
  return (
    <main className="min-h-screen flex flex-col items-center px-6 py-10 relative overflow-hidden">
      {/* Hero gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none hero-gradient"
      />

      {/* ── Hero Section ───────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center text-center container-app relative z-10 fade-in">
        <div className="relative mb-8">
          <img
            src={logo}
            alt="C&N Tecidos"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover"
            style={{ boxShadow: "0 8px 32px oklch(0.42 0.12 160 / 0.2)" }}
          />
          <div className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: "linear-gradient(135deg, oklch(0.42 0.12 160), oklch(0.52 0.11 160))" }}
          >
            <Sparkles size={15} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-5xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)", color: "var(--color-primary)", letterSpacing: "-0.03em" }}>
          Seu look dos sonhos<br />
          <span style={{ background: "linear-gradient(135deg, oklch(0.42 0.12 160), oklch(0.72 0.13 75))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            em 30 segundos
          </span>
        </h1>
        <p className="mt-4 text-[15px] sm:text-base leading-relaxed max-w-md" style={{ color: "var(--color-muted-foreground)" }}>
          Nossa IA transforma sua ideia em um croqui exclusivo e gera uma visualização realista da peça — tudo personalizado para você.
        </p>

        {/* Badges */}
        <div className="flex flex-wrap justify-center gap-2 mt-6 fade-in-delay">
          <span className="badge-feature">
            <Zap size={13} /> IA Generativa
          </span>
          <span className="badge-feature">
            <Shield size={13} /> 100% Personalizado
          </span>
          <span className="badge-feature">
            <Wand2 size={13} /> Gratuito
          </span>
        </div>

        {/* CTAs */}
        <div className="w-full mt-8 space-y-3 max-w-sm">
          <button onClick={handleCriarClick} className="btn-primary text-[17px]">
            <Sparkles size={18} /> Criar meu look
          </button>
          <Link to="/qr" className="btn-secondary inline-flex items-center justify-center gap-2">
            <QrCode size={18} /> QR para abrir no celular
          </Link>
        </div>
      </div>

      {/* ── Como Funciona ──────────────────────── */}
      <section className="container-app relative z-10 mt-16 mb-10 w-full fade-in-delay">
        <h2 className="text-center mb-8" style={{ fontFamily: "var(--font-display)", fontSize: "20px", fontWeight: 600, color: "var(--color-foreground)" }}>
          Como funciona
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 stagger-children">
          <div className="step-card">
            <div className="step-card-icon" style={{ background: "linear-gradient(135deg, oklch(0.94 0.04 160), oklch(0.90 0.06 160))", color: "var(--color-primary)" }}>
              <Pencil size={22} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", color: "var(--color-foreground)" }}>Personalize</span>
            <span style={{ fontSize: "13px", color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
              Escolha peça, decote, manga, biotipo e detalhes
            </span>
          </div>
          <div className="step-card">
            <div className="step-card-icon" style={{ background: "linear-gradient(135deg, oklch(0.94 0.04 160), oklch(0.90 0.06 160))", color: "var(--color-primary)" }}>
              <Image size={22} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", color: "var(--color-foreground)" }}>Croqui Instantâneo</span>
            <span style={{ fontSize: "13px", color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
              IA gera croqui exclusivo baseado nas suas escolhas
            </span>
          </div>
          <div className="step-card">
            <div className="step-card-icon" style={{ background: "linear-gradient(135deg, oklch(0.93 0.04 75), oklch(0.88 0.07 75))", color: "oklch(0.5 0.12 75)" }}>
              <Palette size={22} />
            </div>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "15px", color: "var(--color-foreground)" }}>Foto Realista</span>
            <span style={{ fontSize: "13px", color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
              Visualize a peça com cor e tecido em renderização realista
            </span>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────── */}
      <p className="text-[11px] mt-4 relative z-10" style={{ color: "oklch(0.6 0.02 160 / 0.6)" }}>
        Powered by C&amp;N Tecidos · IA Generativa
      </p>

      <NomeModal
        open={showNomeModal}
        onClose={() => setShowNomeModal(false)}
        onConfirm={handleConfirmNome}
      />
    </main>
  );
}
