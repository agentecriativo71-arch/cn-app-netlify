import { describe, expect, it } from "vitest";
import {
  createCrmSupabaseAdminClientFromEnvironment,
  createOperationalSupabaseAdminClientFromEnvironment,
} from "../server/supabaseClients";

describe("separação dos projetos Supabase", () => {
  it("cria o cliente do CRM somente com as credenciais CRM", () => {
    let receivedUrl = "";
    let receivedKey = "";
    const expectedClient = { project: "crm" };

    const client = createCrmSupabaseAdminClientFromEnvironment(
      {
        CRM_SUPABASE_URL: "https://crm.supabase.co",
        CRM_SUPABASE_SERVICE_KEY: "crm-secret",
        VITE_SUPABASE_URL: "https://operational.supabase.co",
        SUPABASE_SERVICE_KEY: "operational-secret",
      },
      (url, key) => {
        receivedUrl = url;
        receivedKey = key;
        return expectedClient;
      },
    );

    expect(client).toBe(expectedClient);
    expect({ receivedUrl, receivedKey }).toEqual({
      receivedUrl: "https://crm.supabase.co",
      receivedKey: "crm-secret",
    });
  });

  it("não usa chaves VITE como credencial administrativa operacional", () => {
    let clientCreated = false;

    const client = createOperationalSupabaseAdminClientFromEnvironment(
      {
        VITE_SUPABASE_URL: "https://operational.supabase.co",
        VITE_SUPABASE_SERVICE_KEY: "legacy-exposed-secret",
        VITE_SUPABASE_ANON_KEY: "public-key",
      },
      () => {
        clientCreated = true;
        return { project: "unexpected" };
      },
    );

    expect(client).toBeNull();
    expect(clientCreated).toBe(false);
  });
});
