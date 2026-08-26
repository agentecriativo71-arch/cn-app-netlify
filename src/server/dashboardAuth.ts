import { createServerFn } from "@tanstack/react-start";
export { isAdministrativeUser, resolveDashboardAuthConfiguration } from "./dashboardAuthPolicy";

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
      const module = await import("./dashboardAuth.server");
      const user = await module.requireAdministrativeUser();
      return { authenticated: true, email: user.email || null };
    } catch {
      return { authenticated: false, email: null };
    }
  });
