import { getRequestHeader, getResponseHeaders, setResponseHeader } from "@tanstack/react-start/server";
import { createServerClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { isAdministrativeUser } from "./dashboardAuth";

type AuthUser = { id: string; email?: string; app_metadata?: Record<string, unknown> };

function createRequestSupabaseClient() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new Error("Autenticação administrativa não configurada.");
  return createServerClient(url, key, {
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

export async function requireAdministrativeUser(): Promise<AuthUser> {
  const supabase = createRequestSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isAdministrativeUser(data.user)) throw new Error("Acesso administrativo negado.");
  return data.user as AuthUser;
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
