import {
  createExecutionAssetStoreFromEnvironment,
  type ExecutionAssetStore,
} from "./executionAssets";

let store: ExecutionAssetStore | null = process.env.NODE_ENV === "test"
  ? null
  : createExecutionAssetStoreFromEnvironment();

export function getExecutionAssetStore(): ExecutionAssetStore | null {
  return store;
}

export function setExecutionAssetStoreForTests(next: ExecutionAssetStore | null): void {
  if (process.env.NODE_ENV !== "test") throw new Error("Injeção de Storage permitida somente em testes.");
  store = next;
}
