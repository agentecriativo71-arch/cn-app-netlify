import { describe, expect, it } from "vitest";
import { CRISPIM_AI_LABEL } from "../lib/brandCopy";

describe("texto público da IA", () => {
  it("usa somente a marca IA da Crispim", () => {
    expect(CRISPIM_AI_LABEL).toBe("IA da Crispim");
  });
});
