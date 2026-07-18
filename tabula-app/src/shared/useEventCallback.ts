import { useCallback, useLayoutEffect, useRef } from "react";

export const useEventCallback = <Args extends unknown[], ReturnValue>(
  callback: (...args: Args) => ReturnValue,
) => {
  const callbackRef = useRef(callback);

  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Args) => callbackRef.current(...args), []);
};
