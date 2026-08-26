import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
  head: () => ({ meta: [{ title: "Dashboard operacional — C&N Tecidos" }] }),
});

function DashboardLayout() {
  return (
    <main className="container-wide px-5 py-8 min-h-screen">
      <header className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-white/60">C&N Tecidos</p>
          <h1 className="text-2xl sm:text-3xl leading-tight font-bold text-white">Dashboard operacional</h1>
        </div>
        <Link to="/" className="shrink-0 text-sm text-white/70 hover:text-white">Voltar ao gerador</Link>
      </header>
      <Outlet />
    </main>
  );
}
