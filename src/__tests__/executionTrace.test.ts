import { describe, expect, it } from "vitest";
import {
  createProviderCallTrace,
  sanitizeProviderReferences,
} from "../server/executionTrace";

describe("rastreio sanitizado de chamadas de provedor", () => {
  it("preserva ordem e contexto das referências sem persistir conteúdo privado", () => {
    const references = sanitizeProviderReferences([
      {
        role: "biotipo",
        source: "catalog",
        selectedValue: "Ampulheta",
        assetName: "ampulheta.png",
        value: "https://cdn.example.com/catalog/ampulheta.png?token=secret",
      },
      {
        role: "customer_crop",
        source: "customer_crop",
        value: "data:image/jpeg;base64,conteudo-privado",
      },
    ]);

    expect(references).toEqual([
      expect.objectContaining({
        position: 1,
        role: "biotipo",
        transport: "https_url",
        providerHost: "cdn.example.com",
        providerPath: "/catalog/ampulheta.png",
        selectedValue: "Ampulheta",
      }),
      expect.objectContaining({
        position: 2,
        role: "customer_crop",
        transport: "data_url",
        providerHost: null,
        providerPath: null,
      }),
    ]);
    expect(JSON.stringify(references)).not.toContain("secret");
    expect(JSON.stringify(references)).not.toContain("conteudo-privado");
  });

  it("registra somente digest e tamanho do template, nunca o prompt", () => {
    const trace = createProviderCallTrace({
      phase: "candidato de croqui",
      operation: "fal-ai/bytedance/seedream/v4/edit",
      templateVersion: "croqui-fidelity-v3",
      template: "prompt confidencial",
      references: [],
    });

    expect(trace.templateDigest).toHaveLength(16);
    expect(trace.templateChars).toBe("prompt confidencial".length);
    expect(JSON.stringify(trace)).not.toContain("prompt confidencial");
  });
});
