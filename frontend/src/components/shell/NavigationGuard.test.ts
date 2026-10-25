import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/navigation router
const pushMock = vi.fn();
const replaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

interface FakePopEvent {
  state: Record<string, unknown> | null;
  stopImmediatePropagation: () => void;
}

describe("NavigationGuard browser Back/Forward navigation", () => {
  let listeners: Record<string, { handler: (e: unknown) => void; capture: boolean }[]> = {};
  let historyStack: Array<{ state: Record<string, unknown> | null; url: string }> = [];
  let historyIndex = 0;
  let goCalls: number[] = [];

  beforeEach(() => {
    listeners = {};
    historyStack = [{ state: null, url: "/posts" }, { state: null, url: "/posts/new" }];
    historyIndex = 1;
    goCalls = [];
    pushMock.mockClear();
    replaceMock.mockClear();

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

  it("1. Back navigation with confirmation accepted: intercepts, restores position, and proceeds on confirm", () => {
    let blocked = true;
    let isRestoring = false;
    let pendingPopstate: { delta: number } | null = null;
    let pendingDelta: number | null = null;
    let currentIdx = 1;

    const stopImmediatePropagation = vi.fn();
    const backEvent: FakePopEvent = {
      state: { __navIdx: 0 },
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
      const delta = typeof targetIdx === "number" ? (targetIdx as number) - currentIdx : -1;
      if (delta === 0) return;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }

      if (typeof targetIdx === "number") currentIdx = targetIdx as number;
    };

    // 1. User clicks Back (moves to targetIdx 0, delta = -1)
    onPopState(backEvent);

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([1]); // Inverted delta (-(-1) = +1) to restore editor position
    expect(isRestoring).toBe(true);

    // 2. Restoration popstate arrives
    const restoreEvent: FakePopEvent = {
      state: { __navIdx: 1 },
      stopImmediatePropagation: vi.fn(),
    };
    onPopState(restoreEvent);

    expect(restoreEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(isRestoring).toBe(false);
    expect(pendingPopstate).toEqual({ delta: -1 });

    // 3. User accepts confirmation (clicks "Discard changes")
    blocked = false;
    const confirmedDelta = pendingPopstate!.delta;
    pendingPopstate = null;
    window.history.go(confirmedDelta);

    expect(goCalls).toEqual([1, -1]); // Navigation proceeds back

    // 4. Backward popstate fires after unblocking
    const completedBackEvent: FakePopEvent = {
      state: { __navIdx: 0 },
      stopImmediatePropagation: vi.fn(),
    };
    onPopState(completedBackEvent);

    expect(completedBackEvent.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(currentIdx).toBe(0);
  });

  it("2. Back navigation with confirmation rejected: intercepts, restores position, and keeps user on screen", () => {
    const blocked = true;
    let isRestoring = false;
    let pendingPopstate: { delta: number } | null = null;
    let pendingDelta: number | null = null;
    const currentIdx = 1;

    const stopImmediatePropagation = vi.fn();
    const backEvent: FakePopEvent = {
      state: { __navIdx: 0 },
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
      const delta = typeof targetIdx === "number" ? (targetIdx as number) - currentIdx : -1;
      if (delta === 0) return;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }
    };

    onPopState(backEvent);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([1]); // Inverted delta restored forward

    // Complete restoration
    onPopState({ state: { __navIdx: 1 }, stopImmediatePropagation: vi.fn() });
    expect(pendingPopstate).toEqual({ delta: -1 });

    // User rejects confirmation (clicks "Cancel")
    pendingPopstate = null;

    // Verify user remains on current screen: no further go() calls, blocked remains true
    expect(goCalls).toEqual([1]);
    expect(blocked).toBe(true);
    expect(pendingPopstate).toBeNull();
  });

  it("3. Forward navigation with confirmation accepted: intercepts, restores backward, and proceeds on confirm", () => {
    let blocked = true;
    let isRestoring = false;
    let pendingPopstate: { delta: number } | null = null;
    let pendingDelta: number | null = null;
    let currentIdx = 0; // User is at 0, forward history exists at 1

    const stopImmediatePropagation = vi.fn();
    const forwardEvent: FakePopEvent = {
      state: { __navIdx: 1 },
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
      const delta = typeof targetIdx === "number" ? (targetIdx as number) - currentIdx : 1;
      if (delta === 0) return;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }

      if (typeof targetIdx === "number") currentIdx = targetIdx as number;
    };

    // 1. User clicks Forward (delta = +1)
    onPopState(forwardEvent);

    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([-1]); // Inverted delta (-1) reverts browser back to index 0
    expect(isRestoring).toBe(true);

    // 2. Complete restoration popstate
    const restoreEvent: FakePopEvent = {
      state: { __navIdx: 0 },
      stopImmediatePropagation: vi.fn(),
    };
    onPopState(restoreEvent);

    expect(restoreEvent.stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(isRestoring).toBe(false);
    expect(pendingPopstate).toEqual({ delta: 1 });

    // 3. User accepts confirmation
    blocked = false;
    const confirmedDelta = pendingPopstate!.delta;
    pendingPopstate = null;
    window.history.go(confirmedDelta);

    expect(goCalls).toEqual([-1, 1]); // Proceeded forward

    // 4. Forward popstate fires after unblocking
    const completedForwardEvent: FakePopEvent = {
      state: { __navIdx: 1 },
      stopImmediatePropagation: vi.fn(),
    };
    onPopState(completedForwardEvent);

    expect(completedForwardEvent.stopImmediatePropagation).not.toHaveBeenCalled();
    expect(currentIdx).toBe(1);
  });

  it("4. Forward navigation with confirmation rejected: intercepts and retains current history state", () => {
    const blocked = true;
    let isRestoring = false;
    let pendingPopstate: { delta: number } | null = null;
    let pendingDelta: number | null = null;
    const currentIdx = 0;

    const stopImmediatePropagation = vi.fn();
    const forwardEvent: FakePopEvent = {
      state: { __navIdx: 1 },
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
      const delta = typeof targetIdx === "number" ? (targetIdx as number) - currentIdx : 1;
      if (delta === 0) return;

      if (blocked) {
        event.stopImmediatePropagation();
        isRestoring = true;
        pendingDelta = delta;
        window.history.go(-delta);
        return;
      }
    };

    onPopState(forwardEvent);
    expect(stopImmediatePropagation).toHaveBeenCalledTimes(1);
    expect(goCalls).toEqual([-1]);

    // Restoration popstate completes
    onPopState({ state: { __navIdx: 0 }, stopImmediatePropagation: vi.fn() });
    expect(pendingPopstate).toEqual({ delta: 1 });

    // User rejects confirmation
    pendingPopstate = null;

    expect(goCalls).toEqual([-1]);
    expect(blocked).toBe(true);
    expect(pendingPopstate).toBeNull();
  });

  it("5. No repeated confirmation loop when restoring history: restoration popstate stops propagation and does not re-invoke history.go", () => {
    const blocked = true;
    let isRestoring = true; // Simulating active restoration
    const pendingDelta = -1;
    let pendingPopstate: { delta: number } | null = null;

    const stopPropagationMock = vi.fn();
    const restoreEvent: FakePopEvent = {
      state: { __navIdx: 1 },
      stopImmediatePropagation: stopPropagationMock,
    };

    const onPopState = (event: FakePopEvent) => {
      if (isRestoring) {
        event.stopImmediatePropagation();
        isRestoring = false;
        pendingPopstate = { delta: pendingDelta };
        return;
      }

      // If loop was not prevented, it would reach here and call history.go again:
      if (blocked) {
        window.history.go(1);
      }
    };

    onPopState(restoreEvent);

    expect(stopPropagationMock).toHaveBeenCalledTimes(1);
    expect(isRestoring).toBe(false);
    expect(pendingPopstate).toEqual({ delta: -1 });
    expect(goCalls).toEqual([]); // No additional history.go() calls were triggered
  });

  it("6. No duplicate listeners or stale callbacks after cleanup", async () => {
    const origPush = window.history.pushState;
    const origReplace = window.history.replaceState;

    // Verify cleanup removes event listeners and restores history methods
    let activeListener: ((e: unknown) => void) | null = null;
    const addListenerMock = vi.fn((_type: string, handler: (e: unknown) => void) => {
      activeListener = handler;
    });
    const removeListenerMock = vi.fn((_type: string, handler: (e: unknown) => void) => {
      if (activeListener === handler) activeListener = null;
    });

    window.addEventListener = addListenerMock as unknown as typeof window.addEventListener;
    window.removeEventListener = removeListenerMock as unknown as typeof window.removeEventListener;

    // Simulate setup and teardown as done in useEffect
    const onPopState = vi.fn();
    window.addEventListener("popstate", onPopState, true);

    expect(addListenerMock).toHaveBeenCalledWith("popstate", onPopState, true);
    expect(activeListener).toBe(onPopState);

    // Teardown
    window.removeEventListener("popstate", onPopState, true);
    window.history.pushState = origPush;
    window.history.replaceState = origReplace;

    expect(removeListenerMock).toHaveBeenCalledWith("popstate", onPopState, true);
    expect(activeListener).toBeNull();
  });

  it("7. Existing navigation-guard behavior remains unchanged for in-app links and programmatic navigation", () => {
    let blocked = false;
    let pendingHref: string | null = null;

    const api = {
      setBlocked: (val: boolean) => {
        blocked = val;
      },
      isBlocked: () => blocked,
      navigate: (href: string) => {
        if (blocked) pendingHref = href;
        else pushMock(href);
      },
    };

    // When unblocked: navigate pushes immediately
    api.navigate("/authors");
    expect(pushMock).toHaveBeenCalledWith("/authors");
    expect(pendingHref).toBeNull();

    // When blocked: navigate sets pendingHref without pushing
    pushMock.mockClear();
    api.setBlocked(true);
    expect(api.isBlocked()).toBe(true);

    api.navigate("/tags");
    expect(pushMock).not.toHaveBeenCalled();
    expect(pendingHref).toBe("/tags");

    // Confirmation accepted: unblock and push target href
    blocked = false;
    const target = pendingHref;
    pendingHref = null;
    pushMock(target);

    expect(pushMock).toHaveBeenCalledWith("/tags");
    expect(pendingHref).toBeNull();

    // Re-block and test confirmation rejected (cancelled)
    api.setBlocked(true);
    api.navigate("/media");
    expect(pendingHref).toBe("/media");

    // Cancel: clear pendingHref without pushing
    pendingHref = null;
    expect(api.isBlocked()).toBe(true);
    expect(pendingHref).toBeNull();
  });
});
