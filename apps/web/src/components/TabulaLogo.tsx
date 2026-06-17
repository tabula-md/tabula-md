import type { CSSProperties } from "react";
import tabulaLogoMaskUrl from "../assets/tabula-black.svg";
import { PRODUCT_NAME } from "../product";

type TabulaLogoProps = {
  className?: string;
  decorative?: boolean;
  label?: string;
  size?: number;
};

type TabulaLogoStyle = CSSProperties & {
  "--tabula-logo-size"?: string;
};

export function TabulaLogo({ className, decorative = true, label = PRODUCT_NAME, size }: TabulaLogoProps) {
  const style: TabulaLogoStyle = {
    WebkitMaskImage: `url(${tabulaLogoMaskUrl})`,
    maskImage: `url(${tabulaLogoMaskUrl})`,
    ...(size ? { "--tabula-logo-size": `${size}px` } : {}),
  };

  return (
    <span
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : label}
      className={["tabula-logo", className].filter(Boolean).join(" ")}
      role={decorative ? undefined : "img"}
      style={style}
    />
  );
}
