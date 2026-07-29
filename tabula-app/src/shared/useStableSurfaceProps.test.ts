import { describe, expect, it } from "vitest";
import {
  areShallowEqualSurfaceProps,
  createSurfacePropsStabilizer,
} from "./useStableSurfaceProps";

describe("areShallowEqualSurfaceProps", () => {
  it("accepts records whose property identities are unchanged", () => {
    const action = () => undefined;
    const files: unknown[] = [];

    expect(areShallowEqualSurfaceProps(
      { action, files, open: true },
      { action, files, open: true },
    )).toBe(true);
  });

  it("rejects changed values and changed property sets", () => {
    expect(areShallowEqualSurfaceProps(
      { open: true },
      { open: false },
    )).toBe(false);
    expect(areShallowEqualSurfaceProps(
      { open: true },
      { open: true, view: "files" },
    )).toBe(false);
  });
});

describe("createSurfacePropsStabilizer", () => {
  it("preserves the props identity while routing events to their latest handler", () => {
    const calls: string[] = [];
    const stabilize = createSurfacePropsStabilizer<{
      label: string;
      onOpen: () => void;
    }>();
    const firstProps = {
      label: "Files",
      onOpen: () => calls.push("first"),
    };
    const secondProps = {
      label: "Files",
      onOpen: () => calls.push("second"),
    };
    const first = stabilize.stabilize(firstProps);
    stabilize.commit(firstProps);
    const second = stabilize.stabilize(secondProps);
    stabilize.commit(secondProps);

    expect(second).toBe(first);
    second.onOpen();
    expect(calls).toEqual(["second"]);
  });

  it("returns new props when a rendered value changes without replacing event proxies", () => {
    const stabilize = createSurfacePropsStabilizer<{
      open: boolean;
      onClose: () => void;
    }>();
    const first = stabilize.stabilize({
      open: false,
      onClose: () => undefined,
    });
    const second = stabilize.stabilize({
      open: true,
      onClose: () => undefined,
    });

    expect(second).not.toBe(first);
    expect(second.onClose).toBe(first.onClose);
  });
});
