"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

/*
 * Guards in-app navigation and browser history navigation (back/forward) while a screen
 * has unsaved changes. The App Router has no route-change event to cancel, so shell
 * links go through <GuardedLink> and browser popstate events are trapped by
 * NavigationGuardProvider. Tab close and reload are covered separately by
 * useUnsavedChangesWarning.
 */

interface NavigationGuardApi {
  setBlocked: (blocked: boolean) => void;
  /** Navigates to `href`, asking first if navigation is blocked. */
  navigate: (href: string) => void;
  isBlocked: () => boolean;
}

const NavigationGuardContext = createContext<NavigationGuardApi | null>(null);

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const blocked = useRef(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [pendingPopstate, setPendingPopstate] = useState<{ delta: number } | null>(null);

  const currentIdxRef = useRef<number>(0);
  const isRestoringRef = useRef<boolean>(false);
  const pendingDeltaRef = useRef<number | null>(null);
  const pendingHrefRef = useRef<string | null>(null);
  const pendingPopstateRef = useRef<{ delta: number } | null>(null);
  const restoreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pendingHrefRef.current = pendingHref;
  }, [pendingHref]);

  useEffect(() => {
    pendingPopstateRef.current = pendingPopstate;
  }, [pendingPopstate]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const state = window.history.state;
    if (state && typeof state.__navIdx === "number") {
      currentIdxRef.current = state.__navIdx;
    } else {
      currentIdxRef.current = 0;
      window.history.replaceState({ ...state, __navIdx: 0 }, "");
    }

    const origPushState = window.history.pushState.bind(window.history);
    const origReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (data, unused, url) => {
      currentIdxRef.current += 1;
      const nextState =
        typeof data === "object" && data !== null
          ? { ...data, __navIdx: currentIdxRef.current }
          : { __navIdx: currentIdxRef.current };
      return origPushState(nextState, unused, url);
    };

    window.history.replaceState = (data, unused, url) => {
      const nextState =
        typeof data === "object" && data !== null
          ? { ...data, __navIdx: currentIdxRef.current }
          : { __navIdx: currentIdxRef.current };
      return origReplaceState(nextState, unused, url);
    };

    const onPopState = (event: PopStateEvent) => {
      if (isRestoringRef.current) {
        // This popstate was triggered by our own history.go() restoration.
        event.stopImmediatePropagation();
        isRestoringRef.current = false;
        if (restoreTimerRef.current) {
          clearTimeout(restoreTimerRef.current);
          restoreTimerRef.current = null;
        }
        if (pendingDeltaRef.current !== null) {
          setPendingPopstate({ delta: pendingDeltaRef.current });
          pendingDeltaRef.current = null;
        }
        return;
      }

      const targetIdx = (event.state as Record<string, unknown> | null)?.__navIdx;
      const delta = typeof targetIdx === "number" ? targetIdx - currentIdxRef.current : -1;

      if (delta === 0) return;

      if (blocked.current) {
        event.stopImmediatePropagation();

        // If a confirm dialog is already active, stay on the current page.
        if (pendingPopstateRef.current !== null || pendingHrefRef.current !== null) {
          isRestoringRef.current = true;
          window.history.go(-delta);
          return;
        }

        isRestoringRef.current = true;
        pendingDeltaRef.current = delta;
        window.history.go(-delta);

        // Fallback for environments where history.go doesn't dispatch a popstate event.
        if (restoreTimerRef.current) clearTimeout(restoreTimerRef.current);
        restoreTimerRef.current = setTimeout(() => {
          if (isRestoringRef.current && pendingDeltaRef.current !== null) {
            isRestoringRef.current = false;
            setPendingPopstate({ delta: pendingDeltaRef.current });
            pendingDeltaRef.current = null;
          }
        }, 80);
        return;
      }

      if (typeof targetIdx === "number") {
        currentIdxRef.current = targetIdx;
      }
    };

    window.addEventListener("popstate", onPopState, true);

    return () => {
      if (restoreTimerRef.current) {
        clearTimeout(restoreTimerRef.current);
      }
      window.history.pushState = origPushState;
      window.history.replaceState = origReplaceState;
      window.removeEventListener("popstate", onPopState, true);
    };
  }, []);

  const api = useMemo<NavigationGuardApi>(
    () => ({
      setBlocked: (value) => {
        blocked.current = value;
      },
      isBlocked: () => blocked.current,
      navigate: (href) => {
        if (blocked.current) setPendingHref(href);
        else router.push(href);
      },
    }),
    [router],
  );

  return (
    <NavigationGuardContext.Provider value={api}>
      {children}
      {(pendingHref || pendingPopstate) && (
        <ConfirmDialog
          title="Discard unsaved changes?"
          message="You have changes that haven’t been saved. Leave anyway?"
          confirmLabel="Discard changes"
          danger
          onClose={() => {
            setPendingHref(null);
            setPendingPopstate(null);
          }}
          onConfirm={() => {
            blocked.current = false;
            if (pendingHref) {
              const href = pendingHref;
              setPendingHref(null);
              router.push(href);
            } else if (pendingPopstate) {
              const { delta } = pendingPopstate;
              setPendingPopstate(null);
              window.history.go(delta);
            }
          }}
        />
      )}
    </NavigationGuardContext.Provider>
  );
}

function useNavigationGuard(): NavigationGuardApi {
  const context = useContext(NavigationGuardContext);
  if (!context) throw new Error("Navigation guard used outside <NavigationGuardProvider>");
  return context;
}

/** Blocks shell navigation while `dirty` is true; unblocks on unmount. */
export function useBlockNavigation(dirty: boolean): void {
  const { setBlocked } = useNavigationGuard();
  useEffect(() => {
    setBlocked(dirty);
    return () => setBlocked(false);
  }, [dirty, setBlocked]);
}

/** Programmatic navigation that respects the guard (e.g. after an action). */
export function useGuardedNavigate(): (href: string) => void {
  return useNavigationGuard().navigate;
}

/** A next/link that asks before leaving a screen with unsaved changes. */
export function GuardedLink({ href, onClick, ...props }: React.ComponentProps<typeof Link> & { href: string }) {
  const guard = useNavigationGuard();
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement>) => {
      onClick?.(event);
      // Let modified clicks (new tab, etc.) through untouched.
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      if (guard.isBlocked()) {
        event.preventDefault();
        guard.navigate(href);
      }
    },
    [guard, href, onClick],
  );
  return <Link href={href} onClick={handleClick} {...props} />;
}
