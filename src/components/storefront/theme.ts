import type { ResolvedTheme } from "@/modules/creator/types";

/**
 * Turns a resolved theme into Tailwind class strings.
 *
 * Kept as data rather than a template string so every value is a class Tailwind can see
 * at build time — a class assembled from a variable would be purged and silently lose
 * its styling in production.
 */
export function buttonClassForTheme(theme: ResolvedTheme): string {
  const radius = {
    none: "rounded-none",
    md: "rounded-lg",
    full: "rounded-full",
  }[theme.buttonRadius];

  const surface = {
    solid: "border-transparent",
    outline: "border-current bg-transparent",
    soft: "border-transparent",
  }[theme.buttonStyle];

  return `${radius} ${surface} w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors`;
}

export function fontClassForTheme(fontFamily: ResolvedTheme["fontFamily"]): string {
  return { sans: "font-sans", serif: "font-serif", mono: "font-mono" }[fontFamily];
}

export const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

/** Inline style for a solid accent button: accent background, page background as text. */
export function accentStyleForTheme(theme: ResolvedTheme) {
  return { backgroundColor: theme.accentColor, color: theme.background } as const;
}

/** A translucent version of the text colour, for borders that match the theme. */
export function hairlineStyleForTheme(theme: ResolvedTheme) {
  return { borderColor: `${theme.textColor}22` } as const;
}
