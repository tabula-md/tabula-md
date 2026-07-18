import * as RadixPopover from "@radix-ui/react-popover";
import type { ComponentPropsWithoutRef } from "react";

export const PopoverRoot = RadixPopover.Root;
export const PopoverTrigger = RadixPopover.Trigger;

type PopoverContentProps = ComponentPropsWithoutRef<typeof RadixPopover.Content>;

export function PopoverContent({
  align = "end",
  children,
  className = "",
  collisionPadding = 8,
  onEscapeKeyDown,
  sideOffset = 4,
  ...props
}: PopoverContentProps) {
  return (
    <RadixPopover.Portal>
      <RadixPopover.Content
        {...props}
        align={align}
        className={`ui-popover ${className}`.trim()}
        collisionPadding={collisionPadding}
        onEscapeKeyDown={(event) => {
          event.stopPropagation();
          onEscapeKeyDown?.(event);
        }}
        sideOffset={sideOffset}
      >
        {children}
      </RadixPopover.Content>
    </RadixPopover.Portal>
  );
}
