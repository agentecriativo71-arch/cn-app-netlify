import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { VideoBackground } from "@/components/VideoBackground";

describe("VideoBackground", () => {
  it("renderiza o elemento de vídeo com os atributos corretos", () => {
    render(<VideoBackground />);
    const video = screen.getByTestId("video-background") as HTMLVideoElement;
    expect(video).toBeInTheDocument();
    expect(video.tagName).toBe("VIDEO");
    // `muted` é propriedade DOM booleana — JSDOM não serializa como atributo HTML
    expect(video.muted).toBe(true);
    expect(video).toHaveAttribute("playsinline");
    // Vídeo em loop contínuo para movimento ambiente
    expect(video.loop).toBe(true);
  });

  it("o container do vídeo está fixado no fundo (z-0, fixed inset-0)", () => {
    render(<VideoBackground />);
    const container = screen.getByTestId("video-background-container");
    expect(container).toBeInTheDocument();
    expect(container.className).toContain("fixed");
    expect(container.className).toContain("inset-0");
    expect(container.className).toContain("z-0");
  });
});
