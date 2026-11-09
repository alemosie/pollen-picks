// Test-only. Import this FIRST in a test file: it sets the env and the fake network before the code under test is loaded.
import { AsyncLocalStorage } from "node:async_hooks";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { installFakes } from "./fakes";

// Next sets this when the server starts; the request scope helpers (./request) need it.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

// The /dev settings file in this folder (git-ignored, for trying the app by hand) must not change what the tests see.
process.env.POLLEN_DEV_FAKE_FILE ??= join(tmpdir(), `pollen-picks-test-dev-fake-${process.pid}.json`);

export const fakes = installFakes();
