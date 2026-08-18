import { afterEach, describe, expect, it, vi } from "vitest";
import { cropImageToDataUrl } from "../lib/imageCrop";

describe("preparação local dos recortes", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("limita o lado maior a 2048px e exporta JPEG com qualidade inicial alta", async () => {
    const drawImage = vi.fn();
    const toDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,Y3JvcA==");
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ drawImage })),
      toDataURL,
    };
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => tagName === "canvas" ? canvas as unknown as HTMLElement : originalCreateElement(tagName));

    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    }
    vi.stubGlobal("Image", FakeImage);

    await cropImageToDataUrl("data:image/jpeg;base64,original", { x: 10, y: 20, width: 4096, height: 2048 });

    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1024);
    expect(drawImage).toHaveBeenCalledWith(expect.any(FakeImage), 10, 20, 4096, 2048, 0, 0, 2048, 1024);
    expect(toDataURL).toHaveBeenCalledWith("image/jpeg", 0.9);
  });
});
