import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, QrCode } from "lucide-react";
import logo from "@/assets/logo.jpg";

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
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-10 fade-in relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 20%, oklch(0.95 0.04 145 / 0.4), transparent 70%)",
        }}
      />

      <div className="flex-1 flex flex-col items-center justify-center text-center container-app relative z-10">
        <div className="relative mb-10">
          <img
            src={logo}
            alt="C&N Tecidos"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl object-cover shadow-card"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Sparkles size={14} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-primary leading-tight">
          Sistema criativo de geração de Croqui - Crispim
        </h1>
        <p className="mt-3 text-[15px] sm:text-base text-muted-foreground leading-relaxed max-w-sm">
          Nossa IA transforma sua ideia em um croqui em segundos.
        </p>

        <div className="w-full mt-10 space-y-3 max-w-sm">
          <Link to="/criar" className="btn-primary text-[17px]">
            <Sparkles size={18} /> Criar meu look
          </Link>
          <Link to="/qr" className="btn-secondary inline-flex items-center justify-center gap-2">
            <QrCode size={18} /> QR para abrir no celular
          </Link>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-6 relative z-10">
        Powered by C&amp;N Tecidos · IA Generativa
      </p>
    </main>
  );
}
