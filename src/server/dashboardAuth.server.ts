import { getRequestHeader, getResponseHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { isAdministrativeUser, resolveDashboardAuthConfiguration, type DashboardAuthUser } from "./dashboardAuthPolicy";

function createRequestSupabaseClient() {
  const configuration = resolveDashboardAuthConfiguration(process.env);
  if (!configuration.url || !configuration.publishableKey) throw new Error("Autenticação administrativa não configurada.");
  return createServerClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    cookies: {
      getAll: () => parseCookieHeader(getRequestHeader("cookie") || ""),
      setAll: (cookies) => {
        const headers = getResponseHeaders();
        const existing = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : (headers.get("set-cookie") ? [headers.get("set-cookie") as string] : []);
        setResponseHeader("set-cookie", [...existing, ...cookies.map(({ name, value, options }) => serializeCookieHeader(name, value, options))]);
      },
    },
  });
}

export async function requireAdministrativeUser(): Promise<DashboardAuthUser> {
  const supabase = createRequestSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isAdministrativeUser(data.user)) throw new Error("Acesso administrativo negado.");
  return data.user as DashboardAuthUser;
}

export async function signInAdmin(data: { email?: unknown; password?: unknown }) {
  const email = typeof data?.email === "string" ? data.email.trim() : "";
  const password = typeof data?.password === "string" ? data.password : "";
  if (!email || !password) throw new Error("Informe e-mail e senha.");
  const supabase = createRequestSupabaseClient();
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !authData.user || !isAdministrativeUser(authData.user)) {
    await supabase.auth.signOut();
    throw new Error("Credenciais administrativas inválidas.");
  }
  return { success: true, email: authData.user.email || email };
}

export async function signOutAdmin() {
  const supabase = createRequestSupabaseClient();
  await supabase.auth.signOut();
  return { success: true };
}
