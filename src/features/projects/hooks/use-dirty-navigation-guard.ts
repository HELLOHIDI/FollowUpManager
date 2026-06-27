"use client";

import { useEffect } from "react";

const DISCARD_MESSAGE = "저장하지 않은 변경사항을 버릴까요?";
export const DIRTY_GUARD_HISTORY_INDEX = "__grantFollowDirtyGuardIndex";

const stateIndex = (state: unknown) => {
  if (!state || typeof state !== "object") return null;
  const index = (state as Record<string, unknown>)[DIRTY_GUARD_HISTORY_INDEX];
  return typeof index === "number" ? index : null;
};

const navigationIndex = () => {
  const navigation = (window as unknown as { navigation?: { currentEntry?: { index?: number } } }).navigation;
  return typeof navigation?.currentEntry?.index === "number" ? navigation.currentEntry.index : null;
};

export const confirmDiscardChanges = (isDirty: boolean) => !isDirty || window.confirm(DISCARD_MESSAGE);

export const useDirtyNavigationGuard = (isDirty: boolean) => {
  useEffect(() => {
    let currentHistoryIndex = navigationIndex() ?? stateIndex(window.history.state) ?? 0;
    if (stateIndex(window.history.state) === null) {
      window.history.replaceState({ ...(window.history.state ?? {}), [DIRTY_GUARD_HISTORY_INDEX]: currentHistoryIndex }, "", window.location.href);
    }
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (!isDirty || event.defaultPrevented || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank") return;
      const destination = new URL(target.href, window.location.href);
      if (destination.href === window.location.href || destination.origin !== window.location.origin) return;
      if (!window.confirm(DISCARD_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    let restoringHistory = false;
    const popstate = (event: PopStateEvent) => {
      const recordedDestinationIndex = stateIndex(event.state);
      const destinationIndex = navigationIndex() ?? recordedDestinationIndex ?? currentHistoryIndex - 1;
      if (recordedDestinationIndex === null) {
        window.history.replaceState({ ...(event.state ?? {}), [DIRTY_GUARD_HISTORY_INDEX]: destinationIndex }, "", window.location.href);
      }
      if (restoringHistory) {
        restoringHistory = false;
        currentHistoryIndex = destinationIndex;
        return;
      }
      if (!isDirty || window.confirm(DISCARD_MESSAGE)) {
        currentHistoryIndex = destinationIndex;
        return;
      }
      const restorationDelta = currentHistoryIndex - destinationIndex;
      if (restorationDelta === 0) return;
      restoringHistory = true;
      window.history.go(restorationDelta);
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("popstate", popstate);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("popstate", popstate);
      document.removeEventListener("click", click, true);
    };
  }, [isDirty]);
};
