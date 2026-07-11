import {
  Fragment,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MoreHorizontal } from "lucide-react";
import type { MarkdownFormatCommand } from "@tabula-md/tabula";
import {
  formattingToolbarGroupOrder,
  getFormattingToolbarLayout,
  type FormattingToolbarCommand,
  type FormattingToolbarCommandActions,
} from "../toolbar/formattingCommandRegistry";

type FormattingToolbarProps = {
  className?: string;
  canRedo: boolean;
  canUndo: boolean;
  onFormat: (command: MarkdownFormatCommand) => void;
  onRedo: () => void;
  onUndo: () => void;
};

type GroupedFormattingCommands = {
  group: FormattingToolbarCommand["group"];
  commands: FormattingToolbarCommand[];
};

const groupFormattingCommands = (
  commands: FormattingToolbarCommand[],
): GroupedFormattingCommands[] =>
  formattingToolbarGroupOrder
    .map((group) => ({
      group,
      commands: commands.filter((command) => command.group === group),
    }))
    .filter(({ commands }) => commands.length > 0);

const compactToolbarMediaQuery = "(max-width: 560px)";

const isCompactToolbarViewport = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia(compactToolbarMediaQuery).matches;

const getCommandTitle = (command: FormattingToolbarCommand) =>
  command.shortcut ? `${command.tooltip} (${command.shortcut})` : command.tooltip;

const isCommandDisabled = (
  command: FormattingToolbarCommand,
  actions: FormattingToolbarCommandActions,
) => command.isDisabled?.(actions) ?? false;

const applyToolbarCommand = (
  command: FormattingToolbarCommand,
  actions: FormattingToolbarCommandActions,
) => {
  if (isCommandDisabled(command, actions)) {
    return;
  }

  command.applyCommand(actions);
};

const renderPrimaryCommand = (
  command: FormattingToolbarCommand,
  actions: FormattingToolbarCommandActions,
) => {
  const Icon = command.icon;
  const disabled = isCommandDisabled(command, actions);

  return (
    <button
      key={command.id}
      className={`tool-button formatting-button formatting-${command.group}-button`}
      type="button"
      title={getCommandTitle(command)}
      aria-label={command.label}
      data-format-command={command.id}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => applyToolbarCommand(command, actions)}
    >
      <Icon size={16} />
    </button>
  );
};

export function FormattingToolbar({
  className = "",
  canRedo,
  canUndo,
  onFormat,
  onRedo,
  onUndo,
}: FormattingToolbarProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [compact, setCompact] = useState(isCompactToolbarViewport);
  const [overflowMenuStyle, setOverflowMenuStyle] = useState<CSSProperties | undefined>();
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const overflowButtonRef = useRef<HTMLButtonElement | null>(null);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const actions = useMemo<FormattingToolbarCommandActions>(
    () => ({
      canRedo,
      canUndo,
      onFormat,
      onRedo,
      onUndo,
    }),
    [canRedo, canUndo, onFormat, onRedo, onUndo],
  );
  const { primary, overflow } = useMemo(() => getFormattingToolbarLayout(compact), [compact]);
  const primaryCommandGroups = useMemo(() => groupFormattingCommands(primary), [primary]);
  const overflowCommandGroups = useMemo(() => groupFormattingCommands(overflow), [overflow]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mediaQuery = window.matchMedia(compactToolbarMediaQuery);
    const updateCompactState = () => setCompact(mediaQuery.matches);
    updateCompactState();
    mediaQuery.addEventListener("change", updateCompactState);
    return () => mediaQuery.removeEventListener("change", updateCompactState);
  }, []);

  const closeOverflowMenu = (restoreFocus = false) => {
    setOverflowOpen(false);
    if (restoreFocus) {
      window.requestAnimationFrame(() => overflowButtonRef.current?.focus());
    }
  };

  const getOverflowMenuItems = () =>
    Array.from(overflowMenuRef.current?.querySelectorAll<HTMLButtonElement>(".formatting-overflow-item") ?? [])
      .filter((item) => !item.disabled);

  const focusOverflowMenuItem = (targetIndex: number) => {
    const items = getOverflowMenuItems();
    if (items.length === 0) {
      return;
    }

    const normalizedIndex = (targetIndex + items.length) % items.length;
    items[normalizedIndex]?.focus();
  };

  useEffect(() => {
    if (!overflowOpen) {
      return;
    }

    const closeOverflow = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || overflowRef.current?.contains(target)) {
        return;
      }

      closeOverflowMenu();
    };

    document.addEventListener("pointerdown", closeOverflow);
    return () => document.removeEventListener("pointerdown", closeOverflow);
  }, [overflowOpen]);

  useEffect(() => {
    if (!overflowOpen) {
      return;
    }

    const frame = window.requestAnimationFrame(() => focusOverflowMenuItem(0));
    return () => window.cancelAnimationFrame(frame);
  }, [overflowOpen]);

  const toggleOverflow = () => {
    setOverflowOpen((isOpen) => {
      const nextOpen = !isOpen;
      if (!nextOpen) {
        return false;
      }

      const buttonRect = overflowButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) {
        setOverflowMenuStyle(undefined);
        return true;
      }

      const menuWidth = 236;
      const viewportWidth = window.innerWidth || menuWidth;
      const left = Math.max(12, Math.min(buttonRect.right - menuWidth, viewportWidth - menuWidth - 12));
      setOverflowMenuStyle({
        left,
        top: buttonRect.bottom + 8,
      });
      return true;
    });
  };

  const handleOverflowButtonKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== "ArrowDown") {
      return;
    }

    event.preventDefault();
    if (!overflowOpen) {
      toggleOverflow();
      return;
    }

    focusOverflowMenuItem(0);
  };

  const handleOverflowMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverflowMenu(true);
      return;
    }

    const items = getOverflowMenuItems();
    const activeIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOverflowMenuItem(activeIndex + 1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOverflowMenuItem(activeIndex - 1);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusOverflowMenuItem(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusOverflowMenuItem(items.length - 1);
    }
  };

  return (
    <div className={`formatting-row ${className}`}>
      <nav className="formatting-toolbar" aria-label="Formatting">
        {primaryCommandGroups.map(({ group, commands }, groupIndex) => (
          <Fragment key={group}>
            {groupIndex > 0 && <span className="toolbar-separator" />}
            {commands.map((command) => renderPrimaryCommand(command, actions))}
          </Fragment>
        ))}
        {overflow.length > 0 && (
          <>
            <span className="toolbar-separator" />
            <div className="formatting-overflow" ref={overflowRef}>
              <button
                ref={overflowButtonRef}
                className={`tool-button formatting-button formatting-overflow-button ${overflowOpen ? "active" : ""}`}
                type="button"
                title="More formatting"
                aria-label="More formatting"
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
                data-format-command="more-formatting"
                onMouseDown={(event) => event.preventDefault()}
                onKeyDown={handleOverflowButtonKeyDown}
                onClick={toggleOverflow}
              >
                <MoreHorizontal size={16} />
              </button>
              {overflowOpen && (
                <div
                  ref={overflowMenuRef}
                  className="formatting-overflow-menu"
                  role="menu"
                  aria-label="More formatting"
                  style={overflowMenuStyle}
                  onKeyDown={handleOverflowMenuKeyDown}
                >
                  {overflowCommandGroups.map(({ group, commands }, groupIndex) => (
                    <Fragment key={group}>
                      {groupIndex > 0 && <span className="formatting-overflow-separator" />}
                      {commands.map((command) => {
                        const Icon = command.icon;
                        const disabled = isCommandDisabled(command, actions);
                        return (
                          <button
                            key={command.id}
                            className="formatting-overflow-item"
                            type="button"
                            role="menuitem"
                            title={getCommandTitle(command)}
                            data-format-command={command.id}
                            disabled={disabled}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              applyToolbarCommand(command, actions);
                              closeOverflowMenu(true);
                            }}
                          >
                            <Icon size={15} />
                            <span>{command.label}</span>
                            {command.shortcut && (
                              <kbd>{command.shortcut}</kbd>
                            )}
                          </button>
                        );
                      })}
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </nav>
    </div>
  );
}
