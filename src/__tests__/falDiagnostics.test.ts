import { ValidationError } from "@fal-ai/serverless-client";
import { describe, expect, it } from "vitest";
import {
  classifyFalGenerationError,
  type FalGenerationFailureContext,
} from "../server/falDiagnostics";

const context: FalGenerationFailureContext = {
  model: "seedream-v4",
  candidateIndex: 1,
  providerAttempt: 1,
  referenceRole: "renda",
  referenceValue: "Renda Inteira",
  assetName: "renda-inteira.png",
  referenceSummary: [
    {
      role: "renda",
      selectedValue: "Renda Inteira",
      assetName: "renda-inteira.png",
    },
  ],
};

describe("diagnóstico sanitizado do Fal.ai", () => {
  it("classifica 422 de download de image_urls sem persistir URL ou body", () => {
    const error = new ValidationError({
      message: "Client Error",
      status: 422,
      body: {
        detail: [
          {
            loc: ["body", "image_urls"],
            msg: "Failed to download the file. https://private.test/?token=secret",
            type: "value_error",
          },
        ],
      },
    });

    const diagnostic = classifyFalGenerationError(error, context);

    expect(diagnostic).toMatchObject({
      errorCode: "fal_reference_download_failed",
      provider: "fal",
      model: "seedream-v4",
      httpStatus: 422,
      providerField: "image_urls",
      retryable: false,
      referenceRole: "renda",
      referenceValue: "Renda Inteira",
      assetName: "renda-inteira.png",
      referenceSummary: [
        {
          role: "renda",
          selectedValue: "Renda Inteira",
          assetName: "renda-inteira.png",
        },
      ],
    });
    expect(JSON.stringify(diagnostic)).not.toContain("private.test");
    expect(JSON.stringify(diagnostic)).not.toContain("token");
    expect(JSON.stringify(diagnostic)).not.toContain("secret");
  });

  it("classifica indisponibilidade do provedor como repetível", () => {
    const diagnostic = classifyFalGenerationError(
      Object.assign(new Error("upstream"), { status: 503 }),
      context,
    );

    expect(diagnostic).toMatchObject({
      errorCode: "fal_provider_unavailable",
      httpStatus: 503,
      retryable: true,
    });
  });
});
