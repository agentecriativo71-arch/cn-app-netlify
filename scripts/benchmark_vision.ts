import { createReferenceVisionAnalyzer, type VisionProvider } from "../src/server/referenceVision";
import { validateReferenceAnalysisForMode, type ReferenceAnalysis } from "../src/lib/referenceUtils";
import { readFile } from "node:fs/promises";

type ExpectedFields = Partial<Record<"peca" | "decote" | "manga" | "saia", string>>;
type BenchmarkCase = { name: string; imageDataUrls: string[]; expected: ExpectedFields };

async function fileAsDataUrl(path: string): Promise<string> {
  const bytes = await readFile(path);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

function score(analysis: ReferenceAnalysis, expected: BenchmarkCase["expected"]): number {
  const fields = Object.entries(expected) as Array<[keyof BenchmarkCase["expected"], string]>;
  return fields.filter(([field, value]) => analysis[field as keyof ReferenceAnalysis] && (analysis[field as keyof ReferenceAnalysis] as { value?: unknown }).value === value).length;
}

const imagePaths = process.env.VISION_BENCHMARK_IMAGES?.split(",").map((item) => item.trim()).filter(Boolean) || [];
if (imagePaths.length === 0) throw new Error("Defina VISION_BENCHMARK_IMAGES com caminhos locais separados por vírgula.");

const expected: ExpectedFields = process.env.VISION_BENCHMARK_EXPECTED
  ? JSON.parse(process.env.VISION_BENCHMARK_EXPECTED) as ExpectedFields
  : {};
const images = await Promise.all(imagePaths.map(fileAsDataUrl));
const cases: BenchmarkCase[] = [{ name: "referência fornecida", imageDataUrls: images, expected }];
const providers: VisionProvider[] = ["fal", "openai"];
const results = [];
for (const provider of providers) {
  const analyzer = createReferenceVisionAnalyzer({ provider });
  for (const item of cases) {
    const startedAt = Date.now();
    const result = await analyzer.analyze({ mode: images.length === 2 ? "composite" : "single", occasion: process.env.VISION_BENCHMARK_OCCASION || "Festa", targetPiece: "Vestido", imageDataUrls: item.imageDataUrls });
    const analysis = validateReferenceAnalysisForMode(result.analysis, images.length === 2 ? "composite" : "single");
    const expectedFields = Object.keys(item.expected).length;
    results.push({ provider, model: analyzer.modelName, case: item.name, score: score(analysis, item.expected), expectedFields, accuracy: expectedFields ? score(analysis, item.expected) / expectedFields : null, durationMs: Date.now() - startedAt, analysis });
  }
}
console.log(JSON.stringify({ baseline: { provider: process.env.VISION_PROVIDER || "fal", model: process.env.VISION_MODEL || "google/gemini-2.5-flash" }, results }, null, 2));
