import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIRTY_GUARD_HISTORY_INDEX, useDirtyNavigationGuard } from "./use-dirty-navigation-guard";

describe("useDirtyNavigationGuard", () => {
  afterEach(() => vi.restoreAllMocks());

  it("restores rejected back and forward navigation in the correct direction", () => {
    window.history.replaceState({ [DIRTY_GUARD_HISTORY_INDEX]: 5 }, "", window.location.href);
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useDirtyNavigationGuard(true));

    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { [DIRTY_GUARD_HISTORY_INDEX]: 4 } })));
    expect(go).toHaveBeenLastCalledWith(1);

    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { [DIRTY_GUARD_HISTORY_INDEX]: 5 } })));
    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { [DIRTY_GUARD_HISTORY_INDEX]: 6 } })));

    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(go).toHaveBeenLastCalledWith(-1);
    unmount();
  });

  it("allows popstate navigation after confirmation", () => {
    window.history.replaceState({ [DIRTY_GUARD_HISTORY_INDEX]: 5 }, "", window.location.href);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const go = vi.spyOn(window.history, "go").mockImplementation(() => undefined);
    const { unmount } = renderHook(() => useDirtyNavigationGuard(true));

    act(() => window.dispatchEvent(new PopStateEvent("popstate", { state: { [DIRTY_GUARD_HISTORY_INDEX]: 4 } })));

    expect(go).not.toHaveBeenCalled();
    unmount();
  });
});
