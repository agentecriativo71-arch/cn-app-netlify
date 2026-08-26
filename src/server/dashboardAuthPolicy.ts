export type DashboardAuthUser = {
  id: string;
  email?: string;
  app_metadata?: Record<string, unknown>;
};

export function isAdministrativeUser(user: Pick<DashboardAuthUser, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}

export function resolveDashboardAuthConfiguration(environment: Partial<Pick<
  NodeJS.ProcessEnv,
  "VITE_SUPABASE_URL" | "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY" | "VITE_SUPABASE_ANON_KEY" | "SUPABASE_SERVICE_KEY"
>>) {
  return {
    url: environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || "",
    publishableKey: environment.SUPABASE_PUBLISHABLE_KEY || environment.VITE_SUPABASE_ANON_KEY || "",
  };
}
