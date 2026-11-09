import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const DASH = "/bin/dash";
const skip = existsSync(DASH) ? false : "dash is not installed";
const appRoot = path.resolve(__dirname, "..");

// Runs env.sh under dash in a throwaway copy of the app root so real
// developer .env* files are never read or touched.
const runEnvScript = (
  envFiles: Record<string, string>,
  extraEnv: Record<string, string> = {},
) => {
  const dir = mkdtempSync(path.join(tmpdir(), "envsh-"));
  try {
    copyFileSync(path.join(appRoot, "env.sh"), path.join(dir, "env.sh"));
    copyFileSync(
      path.join(appRoot, "env.defaults.sh"),
      path.join(dir, "env.defaults.sh"),
    );
    for (const [name, content] of Object.entries(envFiles)) {
      writeFileSync(path.join(dir, name), content);
    }

    // Drop inherited inputs env.sh reads: NODE_ENV, the public variables it
    // exports, and its ENVSH_* output and prefix overrides.
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value === undefined || key === "NODE_ENV") continue;
      if (/^(PUBLIC_|NEXT_PUBLIC_|ENVSH_)/.test(key)) continue;
      env[key] = value;
    }
    // dash resolves `. file` through PATH; keep only absolute entries so no
    // relative entry ("", ".", "./") can point back at the working directory.
    env.PATH = (process.env.PATH ?? "")
      .split(path.delimiter)
      .filter((entry) => path.isAbsolute(entry))
      .join(path.delimiter);
    Object.assign(env, extraEnv);

    const result = spawnSync(DASH, ["./env.sh", "true"], {
      cwd: dir,
      // NODE_ENV is deliberately optional here; the script's selection depends on it.
      env: env as NodeJS.ProcessEnv,
      encoding: "utf8",
    });

    const output = path.join(dir, "public", "__env.js");
    // Evaluate the generated script as the browser would and read window.__env.
    const context: { window: { __env?: Record<string, string> } } = {
      window: {},
    };
    if (existsSync(output)) {
      runInNewContext(readFileSync(output, "utf8"), context);
    }
    const values = context.window.__env ?? {};

    return { status: result.status, stderr: result.stderr, values };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test("env.sh - loads .env.local under dash", { skip }, () => {
  const result = runEnvScript({ ".env.local": "PUBLIC_PROBE=local\n" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.values.PROBE, "local");
});

test(
  "env.sh - loads .env under dash when no other file exists",
  { skip },
  () => {
    const result = runEnvScript({ ".env": "PUBLIC_PROBE=dotenv\n" });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.values.PROBE, "dotenv");
  },
);

test("env.sh - loads .env.${NODE_ENV} under dash", { skip }, () => {
  const result = runEnvScript(
    { ".env.development": "PUBLIC_PROBE=development\n" },
    { NODE_ENV: "development" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.values.PROBE, "development");
});

test(
  "env.sh - prefers .env.${NODE_ENV} over .env.local and .env",
  { skip },
  () => {
    const result = runEnvScript(
      {
        ".env.development": "PUBLIC_PROBE=development\n",
        ".env.local": "PUBLIC_PROBE=local\n",
        ".env": "PUBLIC_PROBE=dotenv\n",
      },
      { NODE_ENV: "development" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.values.PROBE, "development");
  },
);

test(
  "env.sh - prefers .env.local over .env when NODE_ENV has no file",
  { skip },
  () => {
    const result = runEnvScript(
      {
        ".env.local": "PUBLIC_PROBE=local\n",
        ".env": "PUBLIC_PROBE=dotenv\n",
      },
      { NODE_ENV: "production" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.values.PROBE, "local");
  },
);

test("env.sh - uses defaults when no environment file exists", { skip }, () => {
  const result = runEnvScript({});

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.values.APP_NAME, "DataGEMS");
  assert.equal(result.values.PROBE, undefined);
});

test("env.sh - lets the selected file override a default", { skip }, () => {
  const result = runEnvScript({ ".env.local": "PUBLIC_APP_NAME=Probe\n" });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.values.APP_NAME, "Probe");
});

test(
  "env.sh - prefers PUBLIC_ over NEXT_PUBLIC_ for the same key",
  { skip },
  () => {
    const result = runEnvScript({
      ".env.local": "NEXT_PUBLIC_PROBE=next\nPUBLIC_PROBE=public\n",
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.values.PROBE, "public");
  },
);

test(
  "env.sh - falls back to .env when NODE_ENV has no file and no .env.local exists",
  { skip },
  () => {
    const result = runEnvScript(
      { ".env": "PUBLIC_PROBE=dotenv\n" },
      { NODE_ENV: "production" },
    );

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.values.PROBE, "dotenv");
  },
);
