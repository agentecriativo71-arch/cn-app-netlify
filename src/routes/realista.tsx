import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Header } from "@/components/Header";
import { useLook } from "@/lib/store";
import { User, Camera } from "lucide-react";

export const Route = createFileRoute("/realista")({
  component: Realista,
  head: () => ({ meta: [{ title: "Foto realista — C&N Tecidos" }] }),
});

function Realista() {
  const router = useRouter();
  const s = useLook();

  const choose = (modo: "manequim" | "foto") => {
    s.set({ modo });
    router.navigate({ to: "/resultado" });
  };

  return (
    <>
      <Header title="Como quer ver?" back="/croqui" />
      <main className="px-5 py-6 space-y-4 fade-in">
        <p className="text-[15px] text-muted-foreground text-center">
          Escolha como deseja visualizar a peça em foto realista.
        </p>

        <button
          onClick={() => choose("manequim")}
          className="w-full card-soft text-left flex items-center gap-4 hover:bg-surface/30 transition"
        >
          <div className="w-14 h-14 rounded-xl bg-surface flex items-center justify-center text-primary">
            <User size={28} />
          </div>
          <div>
            <p className="font-semibold text-foreground">No manequim</p>
            <p className="text-xs text-muted-foreground mt-0.5">Veja como a peça fica em um modelo</p>
          </div>
        </button>

        <button
          onClick={() => choose("foto")}
          className="w-full card-soft text-left flex items-center gap-4 hover:bg-surface/30 transition"
          disabled={!s.fotoUrl}
          style={{ opacity: s.fotoUrl ? 1 : 0.5 }}
        >
          <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center text-primary">
            <Camera size={28} />
          </div>
          <div>
            <p className="font-semibold text-foreground">Na minha foto</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {s.fotoUrl ? "Veja a peça vestida em você" : "Envie sua foto na tela anterior"}
            </p>
          </div>
        </button>
      </main>
    </>
  );
}
