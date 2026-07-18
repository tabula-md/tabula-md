import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import { createContext, useContext, type ComponentPropsWithoutRef, type ReactNode } from "react";

const MenuOpenChangeContext = createContext<((open: boolean) => void) | null>(null);

type MenuRootProps = ComponentPropsWithoutRef<typeof DropdownMenu.Root>;

export function MenuRoot({ children, onOpenChange, ...props }: MenuRootProps) {
  return (
    <MenuOpenChangeContext.Provider value={onOpenChange ?? null}>
      <DropdownMenu.Root {...props} onOpenChange={onOpenChange}>
        {children}
      </DropdownMenu.Root>
    </MenuOpenChangeContext.Provider>
  );
}
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuGroup = DropdownMenu.Group;
export const MenuRadioGroup = DropdownMenu.RadioGroup;
export const MenuSub = DropdownMenu.Sub;

type MenuContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.Content> & {
  ariaLabel: string;
};

export function MenuContent({
  align = "end",
  ariaLabel,
  children,
  className = "",
  collisionPadding = 8,
  onEscapeKeyDown,
  sideOffset = 4,
  ...props
}: MenuContentProps) {
  const onOpenChange = useContext(MenuOpenChangeContext);
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        {...props}
        align={align}
        aria-label={ariaLabel}
        className={`ui-menu ui-command-menu ${className}`.trim()}
        collisionPadding={collisionPadding}
        onEscapeKeyDown={(event) => {
          if (onOpenChange) {
            event.preventDefault();
            onOpenChange(false);
          }
          onEscapeKeyDown?.(event);
        }}
        sideOffset={sideOffset}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

type MenuItemContentProps = {
  icon?: ReactNode;
  label: string;
  trailing?: ReactNode;
};

const MenuItemContent = ({ icon, label, trailing }: MenuItemContentProps) => (
  <>
    <span className="ui-command-menu-icon" aria-hidden="true">{icon}</span>
    <span className="ui-command-menu-label">{label}</span>
    {trailing && <span className="ui-command-menu-trailing">{trailing}</span>}
  </>
);

type MenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.Item> & MenuItemContentProps & {
  danger?: boolean;
};

export function MenuItem({ className = "", danger = false, icon, label, trailing, ...props }: MenuItemProps) {
  return (
    <DropdownMenu.Item
      {...props}
      className={`ui-command-menu-item ${danger ? "danger" : ""} ${className}`.trim()}
    >
      <MenuItemContent icon={icon} label={label} trailing={trailing} />
    </DropdownMenu.Item>
  );
}

type MenuCheckboxItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.CheckboxItem> & MenuItemContentProps & {
  danger?: boolean;
};

export function MenuCheckboxItem({
  checked,
  className = "",
  danger = false,
  icon,
  label,
  trailing,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <DropdownMenu.CheckboxItem
      {...props}
      checked={checked}
      className={`ui-command-menu-item ${checked ? "active" : ""} ${danger ? "danger" : ""} ${className}`.trim()}
    >
      <MenuItemContent icon={icon} label={label} trailing={trailing} />
    </DropdownMenu.CheckboxItem>
  );
}

type MenuRadioItemProps = ComponentPropsWithoutRef<typeof DropdownMenu.RadioItem> & {
  label: string;
};

export function MenuRadioItem({ className = "", label, ...props }: MenuRadioItemProps) {
  return (
    <DropdownMenu.RadioItem {...props} className={`ui-command-menu-item radio ${className}`.trim()}>
      <span className="ui-command-menu-icon" aria-hidden="true">
        <DropdownMenu.ItemIndicator><Check size={14} /></DropdownMenu.ItemIndicator>
      </span>
      <span className="ui-command-menu-label">{label}</span>
    </DropdownMenu.RadioItem>
  );
}

type MenuSubTriggerProps = ComponentPropsWithoutRef<typeof DropdownMenu.SubTrigger> & MenuItemContentProps;

export function MenuSubTrigger({ className = "", icon, label, trailing, ...props }: MenuSubTriggerProps) {
  return (
    <DropdownMenu.SubTrigger {...props} className={`ui-command-menu-item ${className}`.trim()}>
      <MenuItemContent icon={icon} label={label} trailing={trailing ?? <ChevronRight size={14} />} />
    </DropdownMenu.SubTrigger>
  );
}

type MenuSubContentProps = ComponentPropsWithoutRef<typeof DropdownMenu.SubContent> & {
  ariaLabel: string;
};

export function MenuSubContent({ ariaLabel, children, className = "", sideOffset = 4, ...props }: MenuSubContentProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.SubContent
        {...props}
        aria-label={ariaLabel}
        className={`ui-menu ui-command-menu ${className}`.trim()}
        sideOffset={sideOffset}
      >
        {children}
      </DropdownMenu.SubContent>
    </DropdownMenu.Portal>
  );
}
