import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
  head: () => ({ meta: [{ title: "Dashboard operacional — C&N Tecidos" }] }),
});

function DashboardLayout() {
  return (
    <main className="container-wide px-5 py-8 min-h-screen">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">C&N Tecidos</p>
          <h1 className="text-3xl font-bold text-white">Dashboard operacional</h1>
        </div>
        <Link to="/" className="text-sm text-white/70 hover:text-white">Voltar ao gerador</Link>
      </header>
      <Outlet />
    </main>
  );
}
