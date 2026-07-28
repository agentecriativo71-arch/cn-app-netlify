import { describe, it, expect } from "vitest";
import { getTransitionMessage } from "@/lib/transitionMessages";

describe("transitionMessages", () => {
  it("retorna mensagem de transição para a etapa de peça", () => {
    const msg = getTransitionMessage("ocasiao", "peca", {
      nome: "Maria",
      ocasiao: "Casamento",
    });
    expect(msg.title).toContain("Ocasião registrada");
  });

  it("retorna mensagem de transição para biotipo", () => {
    const msg = getTransitionMessage("peca", "biotipo", {
      nome: "Ana",
      peca: "Vestido",
    });
    expect(msg.title).toContain("Ótima escolha");
  });

  it("retorna mensagem para comentário", () => {
    const msg = getTransitionMessage("renda", "comentario", {
      nome: "Juliana Silva",
    });
    expect(msg.title).toContain("Últimos ajustes");
  });
});
