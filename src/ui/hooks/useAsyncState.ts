import { useCallback, useState } from "react";
import type { AsyncState } from "../types.js";

export function useAsyncState<T>(): [
  AsyncState<T>,
  (asyncFn: () => Promise<T>) => Promise<void>,
] {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
  });

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setState({ loading: true });

    try {
      const data = await asyncFn();
      setState({ data, loading: false });
    } catch (error) {
      setState({
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, []);

  return [state, execute];
}
