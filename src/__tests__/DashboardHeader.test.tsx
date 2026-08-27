import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutAdminMock = vi.hoisted(() => vi.fn());
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/dashboardAuth", () => ({ signOutAdminFn: signOutAdminMock }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <a {...props}>{children}</a>,
  useNavigate: () => navigateMock,
}));

import { DashboardHeader } from "../components/DashboardHeader";

describe("cabeçalho do dashboard", () => {
  beforeEach(() => {
    signOutAdminMock.mockReset().mockResolvedValue({ success: true });
    navigateMock.mockReset();
  });

  it("encerra a sessão e volta para o login", async () => {
    render(<DashboardHeader />);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(signOutAdminMock).toHaveBeenCalledOnce();
    expect(navigateMock).toHaveBeenCalledWith({ to: "/dashboard/login" });
  });

  it("informa falha ao encerrar sem esconder o botão", async () => {
    signOutAdminMock.mockRejectedValueOnce(new Error("falha"));
    render(<DashboardHeader />);

    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível sair. Tente novamente.");
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
