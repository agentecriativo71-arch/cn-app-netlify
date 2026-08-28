import { describe, expect, it, vi } from "vitest";
import { resetLookAndNavigateHome } from "../lib/flowReset";

describe("reinício do fluxo", () => {
  it("limpa o look antes de retornar à tela inicial", () => {
    const reset = vi.fn();
    const navigate = vi.fn();

    resetLookAndNavigateHome({ reset }, { navigate });

    expect(reset).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
    expect(reset.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0],
    );
  });
});
