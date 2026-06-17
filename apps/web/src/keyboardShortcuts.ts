export type ShortcutLabels = {
  primary: "Cmd" | "Ctrl";
  alternate: "Option" | "Alt";
};

export const getShortcutLabels = (): ShortcutLabels => {
  if (typeof navigator === "undefined") {
    return { primary: "Ctrl", alternate: "Alt" };
  }

  const platform = (navigator.platform ?? "").toLowerCase();
  const userAgent = (navigator.userAgent ?? "").toLowerCase();
  const isApplePlatform = /mac|iphone|ipad|ipod/.test(platform) || /macintosh|iphone|ipad|ipod/.test(userAgent);

  return isApplePlatform ? { primary: "Cmd", alternate: "Option" } : { primary: "Ctrl", alternate: "Alt" };
};
