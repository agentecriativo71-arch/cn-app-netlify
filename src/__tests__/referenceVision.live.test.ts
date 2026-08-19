import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createReferenceVisionAnalyzer } from "../server/referenceVision";
import { REFERENCE_ANALYSIS_VERSION } from "../lib/referenceUtils";

const fixtureDirectory = process.env.VISION_LIVE_FIXTURE_DIR;
const enabled = Boolean(process.env.OPENAI_API_KEY && fixtureDirectory);
const fixtureCases = [
  { name: "pessoa única", files: ["single.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
  { name: "grupo com alvo recortado", files: ["group-focused-crop.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
  { name: "grupo ainda ambíguo", files: ["group-ambiguous.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
  { name: "imagem parcialmente obstruída", files: ["partially-obstructed.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
  { name: "composição cima e baixo", files: ["top.jpg", "bottom.jpg"], mode: "composite" as const, targetPiece: "Vestido" as const },
  { name: "elemento fora do catálogo", files: ["unsupported-catalog-element.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
  { name: "sem roupa identificável", files: ["no-identifiable-garment.jpg"], mode: "single" as const, targetPiece: "Vestido" as const },
];

describe("GPT-5.4 mini Vision live (opt-in)", () => {
  it.skipIf(!enabled)("exige todos os fixtures sintéticos/licenciados declarados", () => {
    for (const fixture of fixtureCases) {
      for (const file of fixture.files) {
        expect(existsSync(`${fixtureDirectory}/${file}`), `${fixture.name}: ${file}`).toBe(true);
      }
    }
  });

  it.skipIf(!enabled)("analisa cada fixture local somente como recorte", async () => {
    const analyzer = createReferenceVisionAnalyzer({ maxAttempts: 2 });
    for (const fixture of fixtureCases) {
      const imageDataUrls = fixture.files.map((file) => {
        const path = `${fixtureDirectory}/${file}`;
        const bytes = readFileSync(path);
        const extension = file.toLowerCase().split(".").pop();
        const mime = extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
        return `data:${mime};base64,${bytes.toString("base64")}`;
      });
      const analysis = await analyzer.analyze({ mode: fixture.mode, targetPiece: fixture.targetPiece, imageDataUrls });
      expect(analysis.schemaVersion, fixture.name).toBe(REFERENCE_ANALYSIS_VERSION);
      expect(analysis.focus, fixture.name).toHaveLength(fixture.mode === "composite" ? 2 : 1);
    }
  });
});
