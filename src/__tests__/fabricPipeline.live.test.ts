import * as fal from "@fal-ai/serverless-client";
import { describe, expect, it } from "vitest";
import { evaluateFabricCandidates, runFabricPipeline } from "../server/fabricPipeline";

interface FabricBenchmarkCase {
  id: string;
  croquiUrl: string;
  tecidoImageUrl: string;
  tecidoSku?: string;
  tecidoNome?: string;
  pecaEn: string;
  mannequinUrl: string;
  background: string;
  elementFragment?: string;
  garmentTypeInstruction?: string;
  sleevelessInstruction?: string;
  mannequinSurfaceInstruction?: string;
}

function loadCases(): FabricBenchmarkCase[] {
  const raw = process.env.FABRIC_BENCHMARK_CASES_JSON;
  if (!raw) return [];
  try {
    const cases = JSON.parse(raw);
    return Array.isArray(cases) ? cases : [];
  } catch {
    return [];
  }
}

const benchmarkCases = loadCases();
const enabled = process.env.FABRIC_BENCHMARK_LIVE === "true"
  && Boolean(process.env.FAL_KEY)
  && benchmarkCases.length >= 10;

describe.skipIf(!enabled)("benchmark live de fidelidade de tecidos", () => {
  it("gera resultados para pelo menos dez SKUs fornecidos pelo ambiente", async () => {
    fal.config({ credentials: process.env.FAL_KEY });
    const results = [];

    for (const benchmarkCase of benchmarkCases) {
      const result = await runFabricPipeline({
        client: fal,
        ...benchmarkCase,
        evaluate: (candidates, context) => evaluateFabricCandidates({
          client: fal,
          normalizedFabricUrl: context.normalizedFabricUrl,
          intermediateUrl: context.intermediateUrl,
          candidates,
        }),
      });
      results.push({
        id: benchmarkCase.id,
        sku: benchmarkCase.tecidoSku || null,
        selectedVariant: result.selected.index,
        selectedScore: result.selected.score,
        candidates: result.candidates.map((candidate) => ({
          index: candidate.index,
          score: candidate.scores,
          url: candidate.url,
        })),
      });
    }

    console.log("[FABRIC BENCHMARK]", JSON.stringify(results));
    expect(results).toHaveLength(benchmarkCases.length);
    expect(results.every((result) => result.selectedScore >= 3)).toBe(true);
  }, 1_200_000);
});
