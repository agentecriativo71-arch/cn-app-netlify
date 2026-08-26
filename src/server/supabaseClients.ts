import { createClient, type SupabaseClient, type SupabaseClientOptions } from "@supabase/supabase-js";

type SupabaseEnvironment = Partial<Pick<
  NodeJS.ProcessEnv,
  | "VITE_SUPABASE_URL"
  | "SUPABASE_URL"
  | "SUPABASE_SERVICE_KEY"
  | "VITE_SUPABASE_SERVICE_KEY"
  | "VITE_SUPABASE_ANON_KEY"
  | "CRM_SUPABASE_URL"
  | "CRM_SUPABASE_SERVICE_KEY"
>>;

type ClientFactory<TClient> = (
  url: string,
  key: string,
  options: SupabaseClientOptions<"public">,
) => TClient;

const adminClientOptions: SupabaseClientOptions<"public"> = {
  auth: { persistSession: false, autoRefreshToken: false },
};

function defaultClientFactory(url: string, key: string, options: SupabaseClientOptions<"public">): SupabaseClient {
  return createClient(url, key, options);
}

export function createOperationalSupabaseAdminClientFromEnvironment<TClient = SupabaseClient>(
  environment: SupabaseEnvironment,
  createSupabaseClient: ClientFactory<TClient> = defaultClientFactory as ClientFactory<TClient>,
): TClient | null {
  const url = environment.VITE_SUPABASE_URL || environment.SUPABASE_URL || "";
  const serviceKey = environment.SUPABASE_SERVICE_KEY || "";
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, adminClientOptions);
}

export function createCrmSupabaseAdminClientFromEnvironment<TClient = SupabaseClient>(
  environment: SupabaseEnvironment,
  createSupabaseClient: ClientFactory<TClient> = defaultClientFactory as ClientFactory<TClient>,
): TClient | null {
  const url = environment.CRM_SUPABASE_URL || "";
  const serviceKey = environment.CRM_SUPABASE_SERVICE_KEY || "";
  if (!url || !serviceKey) return null;
  return createSupabaseClient(url, serviceKey, adminClientOptions);
}

const operationalAdminClient = createOperationalSupabaseAdminClientFromEnvironment(process.env);
const crmAdminClient = createCrmSupabaseAdminClientFromEnvironment(process.env);

export function getOperationalSupabaseAdminClient(): SupabaseClient | null {
  return operationalAdminClient;
}

export function getCrmSupabaseAdminClient(): SupabaseClient | null {
  return crmAdminClient;
}
