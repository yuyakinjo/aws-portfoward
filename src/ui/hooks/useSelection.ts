import { useCallback, useState } from "react";
import type { SelectionState } from "../types.js";

export function useSelection(initialState: Partial<SelectionState> = {}) {
  const [selections, setSelections] = useState<SelectionState>(initialState);

  const updateSelection = useCallback((updates: Partial<SelectionState>) => {
    setSelections((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetSelections = useCallback(() => {
    setSelections({});
  }, []);

  const hasSelection = useCallback(
    (key: keyof SelectionState) => {
      return Boolean(selections[key]);
    },
    [selections],
  );

  return {
    selections,
    updateSelection,
    resetSelections,
    hasSelection,
  };
}
