import { describe, expect, it } from "vitest";
import { shouldRenderVideoBackground } from "../lib/dashboardVisual";

describe("fundo visual do dashboard", () => {
  it("não monta vídeo em nenhuma rota do dashboard", () => {
    expect(shouldRenderVideoBackground("/dashboard")).toBe(false);
    expect(shouldRenderVideoBackground("/dashboard/login")).toBe(false);
    expect(shouldRenderVideoBackground("/dashboard/execucoes/abc")).toBe(false);
  });

  it("mantém vídeo no gerador público", () => {
    expect(shouldRenderVideoBackground("/")).toBe(true);
    expect(shouldRenderVideoBackground("/croqui")).toBe(true);
    expect(shouldRenderVideoBackground("/resultado")).toBe(true);
  });
});
