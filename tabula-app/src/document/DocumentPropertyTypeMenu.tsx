import {
  Braces,
  CalendarClock,
  CalendarDays,
  CheckSquare2,
  Hash,
  List,
  Minus,
  Type,
} from "lucide-react";
import type { FrontmatterPropertyType } from "@tabula-md/tabula";
import {
  MenuContent,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRoot,
  MenuTrigger,
} from "../ui/Menu";
import type { DocumentPropertiesCopy } from "./documentPropertiesLocale";

const propertyTypes: FrontmatterPropertyType[] = [
  "text",
  "number",
  "checkbox",
  "date",
  "datetime",
  "list",
  "object",
  "empty",
];

const getTypeIcon = (type: FrontmatterPropertyType, size = 16) => {
  const props = { "aria-hidden": true, size } as const;
  switch (type) {
    case "number": return <Hash {...props} />;
    case "checkbox": return <CheckSquare2 {...props} />;
    case "date": return <CalendarDays {...props} />;
    case "datetime": return <CalendarClock {...props} />;
    case "list": return <List {...props} />;
    case "object": return <Braces {...props} />;
    case "empty": return <Minus {...props} />;
    default: return <Type {...props} />;
  }
};

type DocumentPropertyTypeMenuProps = {
  copy: DocumentPropertiesCopy;
  label: string;
  onChange: (type: FrontmatterPropertyType) => void;
  value: FrontmatterPropertyType;
};

export function DocumentPropertyTypeMenu({
  copy,
  label,
  onChange,
  value,
}: DocumentPropertyTypeMenuProps) {
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button className="document-property-type-trigger" type="button" aria-label={label}>
          {getTypeIcon(value)}
        </button>
      </MenuTrigger>
      <MenuContent align="start" ariaLabel={label} className="document-property-type-menu">
        <MenuRadioGroup
          value={value}
          onValueChange={(nextValue) => onChange(nextValue as FrontmatterPropertyType)}
        >
          {propertyTypes.map((type) => (
            <MenuRadioItem
              key={type}
              value={type}
              icon={getTypeIcon(type, 15)}
              label={copy[type]}
            />
          ))}
        </MenuRadioGroup>
      </MenuContent>
    </MenuRoot>
  );
}
