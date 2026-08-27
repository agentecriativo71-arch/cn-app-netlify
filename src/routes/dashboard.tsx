import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardHeader } from "@/components/DashboardHeader";

export const Route = createFileRoute("/dashboard")({
  component: DashboardLayout,
  head: () => ({ meta: [{ title: "Dashboard operacional — C&N Tecidos" }] }),
});

function DashboardLayout() {
  return (
    <main className="container-wide px-5 py-8 min-h-screen">
      <DashboardHeader />
      <Outlet />
    </main>
  );
}
