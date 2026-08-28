import { describe, it, expect } from "vitest";
import {
  getBackgroundInstruction,
  getAvailableColors,
  isFormValidForNoiva,
  getMannequinUrl,
  MANNEQUIN_URLS,
  buildSleevelessInstruction,
  buildMannequinSurfaceInstruction,
  clearIncompatibleLookFields,
  getPieceFlowRules,
} from "../lib/noivaUtils";

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
      decote: "V (V-Neck)",
      possuiManga: false,
      manga: null,
      saia: "Evasê",
      renda: "Renda Inteira",
      comentario: "",
    };

    expect(isFormValidForNoiva(estadoSemComentario)).toBe(false);

    const estadoComComentario = {
      ...estadoSemComentario,
      comentario: "Quero laço grande nas costas",
    };

    expect(isFormValidForNoiva(estadoComComentario)).toBe(true);
  });

  it("deve retornar URL correta do manequim por biotipo", () => {
    expect(getMannequinUrl("Ampulheta")).toBe(MANNEQUIN_URLS["Ampulheta"]);
    expect(getMannequinUrl("Triângulo")).toBe(MANNEQUIN_URLS["Triângulo"]);
    expect(getMannequinUrl("Triângulo Invertido")).toBe(MANNEQUIN_URLS["Triângulo Invertido"]);
    expect(getMannequinUrl("Retângulo")).toBe(MANNEQUIN_URLS["Retângulo"]);
  });

  it("deve retornar o manequim Ampulheta padrão para biotipo inválido ou nulo", () => {
    expect(getMannequinUrl(null)).toBe(MANNEQUIN_URLS["Ampulheta"]);
    expect(getMannequinUrl(undefined)).toBe(MANNEQUIN_URLS["Ampulheta"]);
    expect(getMannequinUrl("Biotipo Inexistente")).toBe(MANNEQUIN_URLS["Ampulheta"]);
  });

  it("deve conter URLs do Supabase elementos para todos os biotipos", () => {
    Object.values(MANNEQUIN_URLS).forEach((url) => {
      expect(url).toContain("szbptnoviikflyzulhhs.supabase.co");
      expect(url).toContain("/elementos/manequins/");
    });
  });

  it("deve gerar instrução estrita de tomara que caia (sem alças)", () => {
    const inst = buildSleevelessInstruction("Tomara que Caia", null);
    expect(inst).toContain("STRAPLESS GARMENT (TOMARA QUE CAIA)");
    expect(inst).toContain("NO shoulder straps");
    expect(inst).toContain("100% bare mannequin surface");
  });

  it("deve gerar instrução de frente única", () => {
    const inst = buildSleevelessInstruction("Frente Única", null);
    expect(inst).toContain("HALTER NECK GARMENT (FRENTE ÚNICA)");
  });

  it("deve respeitar mangas quando o usuário escolher manga explicitamente", () => {
    const inst = buildSleevelessInstruction("Tomara que Caia", "Manga Longa");
    expect(inst).toBe("");
  });

  it("deve gerar instrução para remoção de collant/roupas de baixo e proporções de membros", () => {
    const inst = buildMannequinSurfaceInstruction();
    expect(inst).toContain("CRITICAL MANNEQUIN SURFACE & UNDERGARMENT REMOVAL");
    expect(inst).toContain("Do NOT show, render, or bleed any grey bodysuit");
    expect(inst).toContain("MANNEQUIN ANATOMY");
  });

  it("limpa campos incompatíveis ao trocar para peça de baixo", () => {
    expect(clearIncompatibleLookFields("Saia", "Festa")).toMatchObject({ decote: null, manga: null, possuiManga: null, rendaDecisao: null, renda: null });
  });

  it("mantém Blazer sem opções de decote, manga ou biotipo", () => {
    expect(getPieceFlowRules("Blazer")).toMatchObject({
      showDecote: false,
      showManga: false,
      showBiotipo: false,
    });
    expect(isFormValidForNoiva({
      nome: "Maria",
      ocasiao: "Fardamento",
      peca: "Blazer",
      biotipo: null,
      decote: null,
      manga: null,
      possuiManga: null,
    })).toBe(true);
    expect(clearIncompatibleLookFields("Blazer", "Fardamento")).toMatchObject({
      decote: null,
      biotipo: null,
    });
  });
});
