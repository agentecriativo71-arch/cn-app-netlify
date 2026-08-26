import { createServerFn } from "@tanstack/react-start";

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };

export function isAdministrativeUser(user: Pick<AuthUser, "app_metadata"> | null | undefined): boolean {
  return user?.app_metadata?.role === "admin";
}

export async function requireAdministrativeUser(): Promise<AuthUser> {
  const module = await import("./dashboardAuth.server");
  return module.requireAdministrativeUser();
}

export const signInAdminFn: any = createServerFn({ method: "POST" })
  .handler(async ({ data }: any) => {
    const module = await import("./dashboardAuth.server");
    return module.signInAdmin(data);
  });

export const signOutAdminFn: any = createServerFn({ method: "POST" })
  .handler(async () => {
    const module = await import("./dashboardAuth.server");
    return module.signOutAdmin();
  });

export const getAdminSessionFn: any = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const user = await requireAdministrativeUser();
      return { authenticated: true, email: user.email || null };
    } catch {
      return { authenticated: false, email: null };
    }
  });
