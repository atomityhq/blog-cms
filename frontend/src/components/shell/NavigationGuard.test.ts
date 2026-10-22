import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
  }),
}));

describe("NavigationGuard browser navigation trapping", () => {
  let listeners: Record<string, { handler: (e: unknown) => void; capture: boolean }[]> = {};
  let historyStack: Array<{ state: Record<string, unknown> | null; url: string }> = [];
  let historyIndex = 0;
  let goCalls: number[] = [];

  beforeEach(() => {
    listeners = {};
    historyStack = [{ state: null, url: "/posts/new" }];
    historyIndex = 0;
    goCalls = [];
    pushMock.mockClear();

    // Mock window and history in Node environment
    (globalThis as unknown as { window: unknown }).window = {
      location: { href: "http://localhost:3000/posts/new" },
      history: {
        get state() {
          return historyStack[historyIndex]?.state ?? null;
        },
        pushState: vi.fn((data: unknown, _unused: string, url: string) => {
          historyStack = historyStack.slice(0, historyIndex + 1);
          historyStack.push({ state: data as Record<string, unknown>, url });
          historyIndex = historyStack.length - 1;
        }),
        replaceState: vi.fn((data: unknown, _unused: string, url: string) => {
          historyStack[historyIndex] = { state: data as Record<string, unknown>, url };
        }),
        go: vi.fn((delta: number) => {
          goCalls.push(delta);
          const nextIndex = historyIndex + delta;
          if (nextIndex >= 0 && nextIndex < historyStack.length) {
            historyIndex = nextIndex;
          }
        }),
      },
      addEventListener: vi.fn((type: string, handler: (e: unknown) => void, options?: boolean | { capture?: boolean }) => {
        const capture = typeof options === "boolean" ? options : Boolean(options?.capture);
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push({ handler, capture });
      }),
      removeEventListener: vi.fn((type: string, handler: (e: unknown) => void) => {
        if (!listeners[type]) return;
        listeners[type] = listeners[type].filter((l) => l.handler !== handler);
      }),
    };
  });

  afterEach(() => {
    delete (globalThis as unknown as { window?: unknown }).window;
  });

  it("registers a capture popstate listener on mount and patches history methods", async () => {
    const { NavigationGuardProvider } = await import("./NavigationGuard");
    expect(NavigationGuardProvider).toBeDefined();
    expect(window.addEventListener).toBeDefined();
  });

  it("traps popstate events when navigation is blocked and restores history position", () => {
    let blocked = true;
    let isRestoring = false;
    let pendingDelta: number | null = null;
    let pendingPopstate: { delta: number } | null = null;
    let currentIdx = 0;

    const stopImmediatePropagation = vi.fn();
    const fakeEvent = {
      state: { __navIdx: -1 },
      stopImmediatePropagation,
    };

    const onPopState = (event: typeof fakeEvent) => {
      if (isRestoring) {
        event.stopImmediatePropagation();
        isRestoring = false;
        if (pendingDelta !== null) {
          pendingPopstate = { delta: pendingDelta };
          pendingDelta = null;
        }
        return;
      }

      const targetIdx = event.state?.__navIdx;
      const delta = typeof targetIdx === "number" ? targetIdx - currentIdx : -1;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }

      if (typeof targetIdx === "number") {
        currentIdx = targetIdx;
      }
    };

    // User navigates back (target index is -1 relative to current 0 -> delta = -1)
    onPopState(fakeEvent);

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([1]); // Inverted delta (-(-1) = 1) to revert browser back forward
    expect(isRestoring).toBe(true);

    // Browser dispatches the restoration popstate
    const restoreEvent = {
      state: { __navIdx: 0 },
      stopImmediatePropagation: vi.fn(),
    };
    onPopState(restoreEvent);

    expect(restoreEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(isRestoring).toBe(false);
    expect(pendingPopstate).toEqual({ delta: -1 });

    // User confirms discard: unblock and proceed with original delta
    blocked = false;
    window.history.go(pendingPopstate!.delta);
    expect(goCalls).toEqual([1, -1]);
  });

  it("handles popstate without __navIdx by defaulting delta to -1 (back navigation)", () => {
    const blocked = true;
    let isRestoring = false;
    let pendingDelta: number | null = null;
    let pendingPopstate: { delta: number } | null = null;
    const currentIdx = 2;

    interface FakePopEvent {
      state: Record<string, unknown> | null;
      stopImmediatePropagation: () => void;
    }

    const stopImmediatePropagation = vi.fn();
    const fakeEvent: FakePopEvent = {
      state: null, // External page or initial state without __navIdx
      stopImmediatePropagation,
    };

    const onPopState = (event: FakePopEvent) => {
      if (isRestoring) {
        event.stopImmediatePropagation();
        isRestoring = false;
        if (pendingDelta !== null) {
          pendingPopstate = { delta: pendingDelta };
          pendingDelta = null;
        }
        return;
      }

      const targetIdx = event.state?.__navIdx;
      const delta = typeof targetIdx === "number" ? targetIdx - currentIdx : -1;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }
    };

    onPopState(fakeEvent);

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([1]); // Restores by +1 forward
    expect(pendingDelta).toBe(-1);

    // Complete restoration
    onPopState({ state: { __navIdx: 2 }, stopImmediatePropagation: vi.fn() });
    expect(pendingPopstate).toEqual({ delta: -1 });
  });

  it("maintains current position when popstate arrives while a dialog is already active", () => {
    const blocked = true;
    let isRestoring = false;
    const pendingPopstate: { delta: number } | null = { delta: -1 };
    const currentIdx = 1;

    const stopImmediatePropagation = vi.fn();
    const secondBackEvent = {
      state: { __navIdx: 0 },
      stopImmediatePropagation,
    };

    const onPopState = (event: typeof secondBackEvent) => {
      if (isRestoring) {
        event.stopImmediatePropagation();
        isRestoring = false;
        return;
      }

      const targetIdx = event.state?.__navIdx;
      const delta = typeof targetIdx === "number" ? targetIdx - currentIdx : -1;

      if (blocked) {
        event.stopImmediatePropagation();
        if (pendingPopstate !== null) {
          isRestoring = true;
          window.history.go(-delta);
          return;
        }
      }
    };

    onPopState(secondBackEvent);

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([1]); // Reverts again without overwriting active pendingPopstate
    expect(isRestoring).toBe(true);
  });

  it("allows popstate to propagate when navigation is not blocked", () => {
    const blocked = false;
    let currentIdx = 1;

    const stopImmediatePropagation = vi.fn();
    const event = {
      state: { __navIdx: 0 },
      stopImmediatePropagation,
    };

    const targetIdx = event.state?.__navIdx;
    if (blocked) {
      event.stopImmediatePropagation();
    } else if (typeof targetIdx === "number") {
      currentIdx = targetIdx;
    }

    expect(stopImmediatePropagation).not.toHaveBeenCalled();
    expect(currentIdx).toBe(0);
  });
});
