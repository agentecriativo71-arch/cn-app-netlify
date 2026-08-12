import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock getBoundingClientRect
Element.prototype.getBoundingClientRect = vi.fn(() => ({
  x: 100,
  y: 200,
  width: 300,
  height: 150,
  top: 200,
  right: 400,
  bottom: 350,
  left: 100,
  toJSON: () => {},
}));
