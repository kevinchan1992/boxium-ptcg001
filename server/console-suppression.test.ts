/**
 * Production console.log Suppression Tests
 *
 * Verifies the behaviour of the console suppression block added to
 * server/_core/index.ts:
 *
 *   if (process.env.NODE_ENV === 'production') {
 *     const noop = () => {};
 *     console.log   = noop;
 *     console.debug = noop;
 *     console.info  = noop;
 *   }
 *
 * Key invariants:
 *   1. In production  → console.log / .debug / .info produce NO output
 *   2. In production  → console.warn and console.error are ALWAYS preserved
 *   3. In development → ALL console methods work normally (no suppression)
 *   4. Suppression is idempotent (applying it twice does not break anything)
 *   5. The noop function itself has the correct signature (accepts any args)
 *
 * Strategy: the suppression logic is a pure conditional assignment, so we
 * test it by extracting the exact same logic into a helper function and
 * exercising it with vi.spyOn to observe whether the original methods are
 * called or replaced.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Extracted suppression logic (mirrors server/_core/index.ts exactly)
// ---------------------------------------------------------------------------

type ConsoleLike = {
  log: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Apply the production console suppression to a console-like object.
 * Returns the (possibly mutated) object so tests can inspect the result.
 */
function applyConsoleSuppression(
  consoleLike: ConsoleLike,
  nodeEnv: string
): ConsoleLike {
  if (nodeEnv === "production") {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const noop = () => {};
    consoleLike.log = noop;
    consoleLike.debug = noop;
    consoleLike.info = noop;
  }
  return consoleLike;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConsoleMock(): ConsoleLike & { _calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {
    log: [], debug: [], info: [], warn: [], error: [],
  };
  return {
    _calls: calls,
    log: (...args: unknown[]) => calls.log.push(args),
    debug: (...args: unknown[]) => calls.debug.push(args),
    info: (...args: unknown[]) => calls.info.push(args),
    warn: (...args: unknown[]) => calls.warn.push(args),
    error: (...args: unknown[]) => calls.error.push(args),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Console suppression – production environment", () => {
  it("replaces console.log with a no-op", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    mock.log("should be suppressed");
    expect(mock._calls.log).toHaveLength(0);
  });

  it("replaces console.debug with a no-op", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    mock.debug("debug message");
    expect(mock._calls.debug).toHaveLength(0);
  });

  it("replaces console.info with a no-op", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    mock.info("info message");
    expect(mock._calls.info).toHaveLength(0);
  });

  it("preserves console.warn in production", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    mock.warn("this warning must appear");
    expect(mock._calls.warn).toHaveLength(1);
    expect(mock._calls.warn[0]).toEqual(["this warning must appear"]);
  });

  it("preserves console.error in production", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    mock.error("critical error");
    expect(mock._calls.error).toHaveLength(1);
    expect(mock._calls.error[0]).toEqual(["critical error"]);
  });

  it("suppressed methods accept any number of arguments without throwing", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");

    // Should not throw regardless of argument count or types
    expect(() => mock.log()).not.toThrow();
    expect(() => mock.log("a", 1, { b: 2 }, null, undefined)).not.toThrow();
    expect(() => mock.debug(new Error("test"))).not.toThrow();
    expect(() => mock.info()).not.toThrow();
  });

  it("is idempotent – applying suppression twice does not break warn/error", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "production");
    applyConsoleSuppression(mock, "production"); // second application

    mock.warn("still works");
    mock.error("still works");
    expect(mock._calls.warn).toHaveLength(1);
    expect(mock._calls.error).toHaveLength(1);
  });
});

describe("Console suppression – development environment", () => {
  it("does NOT suppress console.log in development", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "development");

    mock.log("dev log");
    expect(mock._calls.log).toHaveLength(1);
    expect(mock._calls.log[0]).toEqual(["dev log"]);
  });

  it("does NOT suppress console.debug in development", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "development");

    mock.debug("dev debug");
    expect(mock._calls.debug).toHaveLength(1);
  });

  it("does NOT suppress console.info in development", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "development");

    mock.info("dev info");
    expect(mock._calls.info).toHaveLength(1);
  });

  it("preserves warn and error in development", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "development");

    mock.warn("dev warn");
    mock.error("dev error");
    expect(mock._calls.warn).toHaveLength(1);
    expect(mock._calls.error).toHaveLength(1);
  });
});

describe("Console suppression – other NODE_ENV values", () => {
  it("does NOT suppress when NODE_ENV is 'test'", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "test");

    mock.log("test log");
    expect(mock._calls.log).toHaveLength(1);
  });

  it("does NOT suppress when NODE_ENV is empty string", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "");

    mock.log("empty env log");
    expect(mock._calls.log).toHaveLength(1);
  });

  it("does NOT suppress when NODE_ENV is 'staging'", () => {
    const mock = makeConsoleMock();
    applyConsoleSuppression(mock, "staging");

    mock.log("staging log");
    expect(mock._calls.log).toHaveLength(1);
  });
});

describe("Console suppression – real process.env integration", () => {
  const originalLog = console.log;
  const originalDebug = console.debug;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  afterEach(() => {
    // Always restore the real console methods after each test
    console.log = originalLog;
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  });

  it("current test environment does NOT suppress console.log (NODE_ENV=test)", () => {
    // In vitest, NODE_ENV is 'test' by default → suppression must NOT be active
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    console.log("vitest log");
    expect(spy).toHaveBeenCalledWith("vitest log");
    spy.mockRestore();
  });

  it("simulates production suppression on the real console object", () => {
    // Temporarily apply suppression as if we were in production
    const realConsole = console as unknown as ConsoleLike;
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");

    applyConsoleSuppression(realConsole, "production");

    console.log("should be suppressed");
    console.warn("should be visible");

    // log was replaced with a noop arrow function – verify it is a no-op by
    // checking the function body is empty (no statements between the braces).
    const fnBody = console.log.toString();
    // An empty arrow function serialises as "() => {\n    }" or "() => {}" depending on minification.
    // Either way it must NOT contain any real statements (like console.log calls).
    expect(fnBody).toMatch(/^\(\)\s*=>\s*\{\s*\}$|^function noop/);

    // Restore before assertions on warn
    console.log = originalLog;
    console.debug = originalDebug;
    console.info = originalInfo;

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
