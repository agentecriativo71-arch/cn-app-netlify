import { describe, expect, it } from "vitest";
import { isAdministrativeUser } from "../server/dashboardAuth";

describe("autorização do dashboard", () => {
  it("aceita somente role admin em app_metadata", () => {
    expect(isAdministrativeUser({ app_metadata: { role: "admin" } })).toBe(true);
    expect(isAdministrativeUser({ app_metadata: { role: "user" } })).toBe(false);
    expect(isAdministrativeUser({ app_metadata: {}, })).toBe(false);
    expect(isAdministrativeUser({ app_metadata: undefined })).toBe(false);
  });
});
