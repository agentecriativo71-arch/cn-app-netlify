import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rateArtifactMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/api", () => ({ rateArtifactFn: rateArtifactMock }));

import { RatingStars } from "../components/RatingStars";

describe("avaliação do resultado", () => {
  beforeEach(() => rateArtifactMock.mockReset().mockResolvedValue({ success: true, score: 4 }));

  it("salva a nota quando o artefato foi rastreado", async () => {
    render(<RatingStars artifactId="artifact-1" executionId="execution-1" trackingStatus="healthy" />);

    await userEvent.click(screen.getByRole("button", { name: "4 estrelas" }));

    expect(rateArtifactMock).toHaveBeenCalledWith({
      data: { artifactId: "artifact-1", executionId: "execution-1", score: 4 },
    });
    expect(await screen.findByText("Obrigado pela avaliação!")).toBeInTheDocument();
  });

  it("explica a indisponibilidade quando o rastreio está degradado", () => {
    render(<RatingStars artifactId={null} executionId={null} trackingStatus="degraded" />);

    expect(screen.getByText("Avaliação indisponível porque este resultado não foi rastreado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "1 estrela" })).not.toBeInTheDocument();
  });
});
