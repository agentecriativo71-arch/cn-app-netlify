import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TutorialProvider, useTutorial } from "@/components/tutorial/TutorialProvider";
import React from "react";

// Componente helper pra testar o context
function TestConsumer({ screenKey }: { screenKey?: string }) {
  const ctx = useTutorial();

  return (
    <div>
      <span data-testid="activeScreen">{ctx.activeScreen ?? "null"}</span>
      <span data-testid="spotlightActive">{String(ctx.spotlightActive)}</span>
      <span data-testid="spotlightStepIndex">{ctx.spotlightStepIndex}</span>
      <span data-testid="bubbleOpen">{String(ctx.bubbleOpen)}</span>
      <span data-testid="bubbleText">{ctx.currentTutorial?.bubbleText ?? "null"}</span>
      <button data-testid="register" onClick={() => ctx.registerScreen(screenKey || "home")}>
        register
      </button>
      <button data-testid="unregister" onClick={() => ctx.unregisterScreen()}>
        unregister
      </button>
      <button data-testid="nextStep" onClick={() => ctx.nextStep()}>
        next
      </button>
      <button data-testid="skip" onClick={() => ctx.skipSpotlight()}>
        skip
      </button>
      <button data-testid="toggleBubble" onClick={() => ctx.toggleBubble()}>
        toggleBubble
      </button>
      <button data-testid="closeBubble" onClick={() => ctx.closeBubble()}>
        closeBubble
      </button>
      <button data-testid="review" onClick={() => ctx.reviewTutorial()}>
        review
      </button>
    </div>
  );
}

function renderWithProvider(screenKey?: string) {
  return render(
    <TutorialProvider>
      <TestConsumer screenKey={screenKey} />
    </TutorialProvider>
  );
}

describe("TutorialProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("inicia com estado neutro", () => {
    renderWithProvider();
    expect(screen.getByTestId("activeScreen").textContent).toBe("null");
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
    expect(screen.getByTestId("bubbleOpen").textContent).toBe("false");
  });

  it("registerScreen ativa spotlight no primeiro acesso", () => {
    renderWithProvider("home");
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("activeScreen").textContent).toBe("home");
    expect(screen.getByTestId("spotlightActive").textContent).toBe("true");
    expect(screen.getByTestId("spotlightStepIndex").textContent).toBe("0");
  });

  it("registerScreen não ativa spotlight se já completado", () => {
    localStorage.setItem("tutorial_completed_home", "true");
    renderWithProvider("home");
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("activeScreen").textContent).toBe("home");
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
  });

  it("nextStep avança o step index", () => {
    renderWithProvider("croqui"); // croqui tem 2 steps
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("spotlightStepIndex").textContent).toBe("0");
    fireEvent.click(screen.getByTestId("nextStep"));
    expect(screen.getByTestId("spotlightStepIndex").textContent).toBe("1");
  });

  it("nextStep no último step fecha spotlight e marca completo", () => {
    renderWithProvider("home"); // home tem 1 step
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("spotlightActive").textContent).toBe("true");
    fireEvent.click(screen.getByTestId("nextStep")); // único step → fecha
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
    expect(localStorage.getItem("tutorial_completed_home")).toBe("true");
  });

  it("skipSpotlight fecha e marca como completo", () => {
    renderWithProvider("home");
    fireEvent.click(screen.getByTestId("register"));
    fireEvent.click(screen.getByTestId("skip"));
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
    expect(localStorage.getItem("tutorial_completed_home")).toBe("true");
  });

  it("toggleBubble abre e fecha", () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId("toggleBubble"));
    expect(screen.getByTestId("bubbleOpen").textContent).toBe("true");
    fireEvent.click(screen.getByTestId("toggleBubble"));
    expect(screen.getByTestId("bubbleOpen").textContent).toBe("false");
  });

  it("closeBubble fecha a bubble", () => {
    renderWithProvider();
    fireEvent.click(screen.getByTestId("toggleBubble"));
    expect(screen.getByTestId("bubbleOpen").textContent).toBe("true");
    fireEvent.click(screen.getByTestId("closeBubble"));
    expect(screen.getByTestId("bubbleOpen").textContent).toBe("false");
  });

  it("reviewTutorial reseta flag e ativa spotlight", () => {
    localStorage.setItem("tutorial_completed_home", "true");
    renderWithProvider("home");
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
    fireEvent.click(screen.getByTestId("review"));
    expect(screen.getByTestId("spotlightActive").textContent).toBe("true");
    expect(localStorage.getItem("tutorial_completed_home")).toBeNull();
  });

  it("unregisterScreen limpa o estado", () => {
    renderWithProvider("home");
    fireEvent.click(screen.getByTestId("register"));
    expect(screen.getByTestId("activeScreen").textContent).toBe("home");
    fireEvent.click(screen.getByTestId("unregister"));
    expect(screen.getByTestId("activeScreen").textContent).toBe("null");
    expect(screen.getByTestId("spotlightActive").textContent).toBe("false");
  });

  it("registra tutorial inexistente sem erro", () => {
    // Renderiza com screenKey inexistente em instância isolada
    const { getByTestId } = render(
      <TutorialProvider>
        <TestConsumer screenKey="nao_existe" />
      </TutorialProvider>
    );
    fireEvent.click(getByTestId("register"));
    // Não deve mudar estado pois a screenKey não existe em TUTORIAL_DATA
    expect(getByTestId("activeScreen").textContent).toBe("null");
  });
});
