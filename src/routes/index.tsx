import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, QrCode } from "lucide-react";
import logo from "@/assets/logo.jpg";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "C&N Tecidos — Agente Criativo" },
      { name: "description", content: "Crie seu look com a Camila, a IA da C&N Tecidos. Croqui e foto realista em segundos." },
    ],
  }),
});

function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-between px-6 py-10 fade-in">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm">
        <img src={logo} alt="C&N Tecidos" className="w-28 h-28 rounded-2xl object-cover shadow-card mb-8" />
        <h1 className="text-3xl font-bold text-primary leading-tight">
          Olá! Sou a Camila ✨
        </h1>
        <p className="mt-3 text-[15px] text-muted-foreground leading-relaxed">
          Nossa IA transforma sua ideia em um croqui em segundos.
        </p>

        <div className="w-full mt-10 space-y-3">
          <Link to="/criar" className="btn-primary">
            <Sparkles size={18} /> Criar meu look
          </Link>
          <Link to="/qr" className="btn-secondary inline-flex items-center justify-center gap-2">
            <QrCode size={18} /> QR para abrir no celular
          </Link>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground/70 mt-6">Powered by C&amp;N Tecidos</p>
    </main>
  );
}
