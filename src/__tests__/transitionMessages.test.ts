import { describe, it, expect } from "vitest";
import { getTransitionMessage } from "@/lib/transitionMessages";

describe("transitionMessages", () => {
  it("retorna mensagem de transição para a etapa de peça", () => {
    const msg = getTransitionMessage("ocasiao", "peca", {
      nome: "Maria",
      ocasiao: "Casamento",
    });
    expect(msg.title).toContain("casamento");
    expect(msg.emoji).toBe("✨");
  });

  it("retorna mensagem de transição para biotipo", () => {
    const msg = getTransitionMessage("peca", "biotipo", {
      nome: "Ana",
      peca: "Vestido",
    });
    expect(msg.title).toContain("Vestido");
    expect(msg.emoji).toBe("🧍‍♀️");
  });

  it("retorna mensagem para comentário com o nome da pessoa", () => {
    const msg = getTransitionMessage("renda", "comentario", {
      nome: "Juliana Silva",
    });
    expect(msg.title).toContain("Juliana");
    expect(msg.emoji).toBe("💬");
  });
});
