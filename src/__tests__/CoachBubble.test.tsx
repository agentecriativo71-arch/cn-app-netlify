import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoachBubble } from "@/components/tutorial/CoachBubble";
import { TutorialProvider, useTutorial } from "@/components/tutorial/TutorialProvider";
import React from "react";

// Helper pra registrar uma tela antes de testar a bubble
function TestWrapper({ screenKey, preComplete }: { screenKey: string; preComplete?: boolean }) {
  return (
    <TutorialProvider>
      <ScreenRegistrar screenKey={screenKey} preComplete={preComplete} />
      <CoachBubble />
    </TutorialProvider>
  );
}

function ScreenRegistrar({ screenKey, preComplete }: { screenKey: string; preComplete?: boolean }) {
  const ctx = useTutorial();
  React.useEffect(() => {
    ctx.registerScreen(screenKey);
    if (preComplete) {
      ctx.skipSpotlight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

describe("CoachBubble", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("não renderiza quando spotlight está ativo (primeiro acesso)", () => {
    render(<TestWrapper screenKey="home" />);
    expect(screen.queryByTestId("coach-bubble")).not.toBeInTheDocument();
  });

  it("renderiza quando tela registrada e tutorial já completo", () => {
    render(<TestWrapper screenKey="home" preComplete />);
    expect(screen.getByTestId("coach-bubble")).toBeInTheDocument();
  });

  it("expande card ao clicar na bubble", () => {
    render(<TestWrapper screenKey="home" preComplete />);
    expect(screen.queryByTestId("coach-card")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coach-bubble"));
    expect(screen.getByTestId("coach-card")).toBeInTheDocument();
  });

  it("fecha card ao clicar no backdrop", () => {
    render(<TestWrapper screenKey="home" preComplete />);
    fireEvent.click(screen.getByTestId("coach-bubble"));
    expect(screen.getByTestId("coach-card")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("coach-backdrop"));
    expect(screen.queryByTestId("coach-card")).not.toBeInTheDocument();
  });

  it("exibe texto correto da bubble para a tela registrada", () => {
    render(<TestWrapper screenKey="home" preComplete />);
    fireEvent.click(screen.getByTestId("coach-bubble"));
    const cardText = screen.getByTestId("coach-card").querySelector(".coach-card-text");
    expect(cardText?.textContent).toContain("Aperte para iniciar");
  });
});
