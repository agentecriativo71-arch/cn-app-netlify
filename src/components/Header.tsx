import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function Header({ title, back = "/" }: { title: string; back?: string }) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-20 h-14 bg-background/95 backdrop-blur border-b flex items-center px-3">
      <button
        onClick={() => (back ? router.navigate({ to: back }) : router.history.back())}
        className="p-2 -ml-2 text-primary"
        aria-label="Voltar"
      >
        <ArrowLeft size={22} />
      </button>
      <h1 className="flex-1 text-center text-[18px] font-semibold text-primary">{title}</h1>
      <Link to="/" className="text-xs font-bold text-secondary tracking-wider">C&amp;N</Link>
    </header>
  );
}
