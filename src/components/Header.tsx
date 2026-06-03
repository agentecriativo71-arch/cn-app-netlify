import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import logo from "@/assets/logo.jpg";

export function Header({ title, back = "/" }: { title: string; back?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/60">
      <div className="container-wide flex items-center h-14 px-4 sm:h-16">
        <button
          onClick={() => (back ? router.navigate({ to: back }) : router.history.back())}
          className="p-2 -ml-2 text-primary hover:bg-surface/50 rounded-xl transition-colors"
          aria-label="Voltar"
        >
          <ArrowLeft size={22} />
        </button>
        <h1 className="flex-1 text-center text-[17px] sm:text-[19px] font-semibold text-primary truncate px-2">
          {title}
        </h1>
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src={logo}
            alt="C&N Tecidos"
            className="hidden sm:block w-7 h-7 rounded-lg object-cover"
          />
          <span className="text-xs font-bold text-secondary tracking-wider">C&amp;N</span>
        </Link>
      </div>
      {/* Gradient accent line */}
      <div className="h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </header>
  );
}
