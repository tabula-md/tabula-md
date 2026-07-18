export type ShortcutPlatform = "apple" | "standard";

export type SemanticShortcut = string;

const appleModifierLabels = new Map([
  ["Control", "⌃"],
  ["Alt", "⌥"],
  ["Shift", "⇧"],
  ["Mod", "⌘"],
]);

const standardModifierLabels = new Map([
  ["Mod", "Ctrl"],
  ["Control", "Ctrl"],
  ["Alt", "Alt"],
  ["Shift", "Shift"],
]);

const appleKeyLabels = new Map([
  ["ArrowLeft", "←"],
  ["ArrowRight", "→"],
  ["Enter", "↵"],
  ["Escape", "Esc"],
]);

const standardKeyLabels = new Map([
  ["ArrowLeft", "Left"],
  ["ArrowRight", "Right"],
  ["Escape", "Esc"],
]);

const appleModifierOrder = ["Control", "Alt", "Shift", "Mod"];
const standardModifierOrder = ["Mod", "Control", "Alt", "Shift"];
const knownModifiers = new Set([...appleModifierOrder, ...standardModifierOrder]);

export const getShortcutPlatform = (): ShortcutPlatform => {
  if (typeof navigator === "undefined") return "standard";

  const platform = (navigator.platform ?? "").toLowerCase();
  const userAgent = (navigator.userAgent ?? "").toLowerCase();
  return /mac|iphone|ipad|ipod/.test(platform) || /macintosh|iphone|ipad|ipod/.test(userAgent)
    ? "apple"
    : "standard";
};

export const formatShortcut = (
  shortcut: SemanticShortcut,
  platform: ShortcutPlatform = getShortcutPlatform(),
) => {
  const parts = shortcut.split("+").map((part) => part.trim()).filter(Boolean);
  const modifierOrder = platform === "apple" ? appleModifierOrder : standardModifierOrder;
  const modifiers = modifierOrder.filter((modifier) => parts.includes(modifier));
  const keys = parts.filter((part) => !knownModifiers.has(part));
  const modifierLabels = platform === "apple" ? appleModifierLabels : standardModifierLabels;
  const keyLabels = platform === "apple" ? appleKeyLabels : standardKeyLabels;
  const labels = [
    ...modifiers.map((modifier) => modifierLabels.get(modifier) ?? modifier),
    ...keys.map((key) => keyLabels.get(key) ?? key),
  ];

  return platform === "apple" ? labels.join("") : labels.join(" + ");
};
