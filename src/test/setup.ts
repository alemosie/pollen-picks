// Test-only. Import this FIRST in a test file: it sets the env and the fake network before the code under test is loaded.
import { AsyncLocalStorage } from "node:async_hooks";
import { installFakes } from "./fakes";

// Next sets this when the server starts; the request scope helpers (./request) need it.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

export const fakes = installFakes();
