import { useLayoutEffect, useRef } from "react";

type SurfaceProps = Record<string, unknown>;
type SurfaceEvent = (...args: unknown[]) => unknown;

export const areShallowEqualSurfaceProps = (
  previous: SurfaceProps,
  next: SurfaceProps,
) => {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  return previousKeys.length === nextKeys.length &&
    previousKeys.every((key) => Object.is(previous[key], next[key]));
};

export const createSurfacePropsStabilizer = <TProps extends SurfaceProps>() => {
  let committedProps: TProps | null = null;
  let stableProps: TProps | null = null;
  const eventProxies = new Map<keyof TProps, SurfaceEvent>();

  return {
    commit(props: TProps) {
      committedProps = props;
    },
    stabilize(props: TProps) {
      const nextProps = { ...props };

      for (const key of Object.keys(props) as Array<keyof TProps>) {
        if (typeof props[key] !== "function") continue;
        let eventProxy = eventProxies.get(key);
        if (!eventProxy) {
          eventProxy = (...args: unknown[]) => {
            const event = committedProps?.[key];
            if (typeof event !== "function") return undefined;
            return event(...args);
          };
          eventProxies.set(key, eventProxy);
        }
        nextProps[key] = eventProxy as TProps[keyof TProps];
      }

      if (stableProps && areShallowEqualSurfaceProps(stableProps, nextProps)) {
        return stableProps;
      }
      stableProps = nextProps;
      return nextProps;
    },
  };
};

export function useStableSurfaceProps<TProps extends SurfaceProps>(
  props: TProps,
): TProps {
  const stabilizeRef = useRef<ReturnType<
    typeof createSurfacePropsStabilizer<TProps>
  > | null>(null);
  if (!stabilizeRef.current) {
    stabilizeRef.current = createSurfacePropsStabilizer<TProps>();
  }
  const stabilizer = stabilizeRef.current;
  const stableProps = stabilizer.stabilize(props);
  useLayoutEffect(() => {
    stabilizer.commit(props);
  }, [props, stabilizer]);
  return stableProps;
}
