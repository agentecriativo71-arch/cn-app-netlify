import { describe, it, expect } from "vitest";
import { getBackgroundInstruction, getAvailableColors, isFormValidForNoiva } from "../lib/noivaUtils";

describe("Fluxo Vestido de Noiva - Ajustes Cliente", () => {
  it("deve retornar fundo bege suave e claro para imagem realista quando for noiva", () => {
    const bgNoiva = getBackgroundInstruction("Noiva");
    expect(bgNoiva).toContain("light");
    expect(bgNoiva).toContain("beige");
    expect(bgNoiva.toLowerCase()).toMatch(/soft muted light beige/);

    const bgOutro = getBackgroundInstruction("Festa");
    expect(bgOutro).toContain("clean white background");
  });

  it("deve disponibilizar apenas Branco e Off-White como cores para noivas", () => {
    const coresNoiva = getAvailableColors("Noiva");
    expect(coresNoiva).toHaveLength(2);
    expect(coresNoiva.map((c) => c.nome)).toEqual(["Branco", "Off-White"]);

    const coresFesta = getAvailableColors("Festa");
    expect(coresFesta.length).toBeGreaterThan(2);
  });

  it("deve exigir detalhes extras (comentário) obrigatoriamente para noivas", () => {
    const estadoSemComentario = {
      nome: "Maria",
      ocasiao: "Noiva",
      tipoCerimonia: "Igreja",
      rendaDecisao: true,
      comprimento: "Longo",
      biotipo: "Ampulheta",
      comentario: "",
    };

    expect(isFormValidForNoiva(estadoSemComentario)).toBe(false);

    const estadoComComentario = {
      ...estadoSemComentario,
      comentario: "Quero laço grande nas costas",
    };

    expect(isFormValidForNoiva(estadoComComentario)).toBe(true);
  });
});
