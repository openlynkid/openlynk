/** Theme presets a creator can pick from without hand-editing colours. */
export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  background: string;
  textColor: string;
  accentColor: string;
  buttonStyle: "solid" | "outline" | "soft";
  buttonRadius: "none" | "md" | "full";
  fontFamily: "sans" | "serif" | "mono";
}

/**
 * Presets are plain data so the renderer, the appearance editor and the tests all read
 * the same list. A preset id that no longer exists falls back to `default`, which is
 * why `resolveTheme` never throws on an unknown preset.
 */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "Minimal",
    description: "Neutral surfaces that stay out of the way of the content.",
    background: "#ffffff",
    textColor: "#111827",
    accentColor: "#111827",
    buttonStyle: "solid",
    buttonRadius: "md",
    fontFamily: "sans",
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark canvas for portfolios and night-time audiences.",
    background: "#0b1120",
    textColor: "#f8fafc",
    accentColor: "#6366f1",
    buttonStyle: "soft",
    buttonRadius: "full",
    fontFamily: "sans",
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm accent for lifestyle and fashion creators.",
    background: "#fff7ed",
    textColor: "#431407",
    accentColor: "#f97316",
    buttonStyle: "solid",
    buttonRadius: "full",
    fontFamily: "serif",
  },
  {
    id: "emerald",
    name: "Emerald",
    description: "Fresh, high-contrast look for coaches and course sellers.",
    background: "#f0fdf4",
    textColor: "#052e16",
    accentColor: "#059669",
    buttonStyle: "outline",
    buttonRadius: "md",
    fontFamily: "sans",
  },
  {
    id: "mono",
    name: "Terminal",
    description: "Monospace, developer-flavoured page for technical creators.",
    background: "#0f172a",
    textColor: "#e2e8f0",
    accentColor: "#22d3ee",
    buttonStyle: "outline",
    buttonRadius: "none",
    fontFamily: "mono",
  },
];

export const DEFAULT_THEME_PRESET_ID = "default";

export function getThemePreset(presetId: string | undefined): ThemePreset {
  const found = THEME_PRESETS.find((preset) => preset.id === presetId);
  return found ?? THEME_PRESETS.find((preset) => preset.id === DEFAULT_THEME_PRESET_ID)!;
}

/** What the storefront actually renders, after the preset is merged with overrides. */
export interface ResolvedTheme {
  background: string;
  textColor: string;
  accentColor: string;
  buttonStyle: "solid" | "outline" | "soft";
  buttonRadius: "none" | "md" | "full";
  fontFamily: "sans" | "serif" | "mono";
}

/** A creator-settable theme, all keys optional. */
export interface ThemeInput {
  preset?: string;
  background?: string;
  textColor?: string;
  accentColor?: string;
  buttonStyle?: "solid" | "outline" | "soft";
  buttonRadius?: "none" | "md" | "full";
  fontFamily?: "sans" | "serif" | "mono";
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** Only a 6-digit hex is accepted, so a creator cannot inject an arbitrary CSS value. */
export function isSafeColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR.test(value);
}

/**
 * Merges a creator's saved theme over its preset. Unknown presets fall back to the
 * default preset and unsafe colour values are ignored rather than rendered, so a bad
 * row can never produce a broken or hostile page.
 */
export function resolveTheme(theme: ThemeInput | null | undefined): ResolvedTheme {
  const preset = getThemePreset(theme?.preset);
  return {
    background: isSafeColor(theme?.background) ? theme.background : preset.background,
    textColor: isSafeColor(theme?.textColor) ? theme.textColor : preset.textColor,
    accentColor: isSafeColor(theme?.accentColor) ? theme.accentColor : preset.accentColor,
    buttonStyle: theme?.buttonStyle ?? preset.buttonStyle,
    buttonRadius: theme?.buttonRadius ?? preset.buttonRadius,
    fontFamily: theme?.fontFamily ?? preset.fontFamily,
  };
}

export type CreatorLinkType = "link" | "header" | "divider" | "text" | "image";
export type ProductDeliveryType = "file" | "link" | "code";
export type ProductType = "digital" | "ebook" | "course" | "membership";

export const PRODUCT_TYPES: ProductType[] = ["digital", "ebook", "course", "membership"];
export const DELIVERY_TYPES: ProductDeliveryType[] = ["file", "link", "code"];

/**
 * The bento grid is 4 columns wide on every viewport, with the tile's own footprint
 * deciding how many it takes. A fixed 4 keeps the stored layout device-independent:
 * a 2-wide tile is half a row on a phone and half a row on a desktop, so the studio
 * preview and the public page cannot disagree about the shape.
 */
export const BENTO_GRID_COLUMNS = 4;
export const BENTO_MAX_ROWS = 3;

/** A tile's footprint on the grid. `w` is a column span, `h` a row span. */
export interface LinkLayout {
  w: number;
  h: number;
}

/**
 * The shapes the studio offers, as presets rather than free-form spans.
 *
 * A creator picks from four named footprints instead of dragging a resize handle: every
 * reachable layout is then one the renderer has a class for (see `src/components/storefront/bento.ts`), and a
 * creator cannot build a 1x3 sliver that strands the auto-flow.
 */
export interface TileSizePreset {
  id: string;
  name: string;
  w: number;
  h: number;
}

export const TILE_SIZE_PRESETS: TileSizePreset[] = [
  { id: "wide", name: "Wide", w: 4, h: 1 },
  { id: "half", name: "Half", w: 2, h: 1 },
  { id: "square", name: "Square", w: 2, h: 2 },
  { id: "feature", name: "Feature", w: 4, h: 2 },
];

export const DEFAULT_TILE_LAYOUT: LinkLayout = { w: 4, h: 1 };

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Resolves a stored layout to a renderable one.
 *
 * Every value is clamped rather than rejected, so a row written by an older build (or
 * hand-edited) still renders as *something* sensible instead of breaking the grid. The
 * parameter is loose (`Partial`) because the stored column and the API payload are both
 * allowed to omit a span; the return is always complete.
 */
export function resolveTileLayout(
  layout: Partial<LinkLayout> | null | undefined
): LinkLayout {
  if (!layout || typeof layout.w !== "number" || typeof layout.h !== "number") {
    return DEFAULT_TILE_LAYOUT;
  }
  return {
    w: clamp(Math.round(layout.w), 1, BENTO_GRID_COLUMNS),
    h: clamp(Math.round(layout.h), 1, BENTO_MAX_ROWS),
  };
}

/** The preset matching a footprint, for the studio to show as selected. */
export function tileSizePresetFor(layout: LinkLayout): TileSizePreset | null {
  return (
    TILE_SIZE_PRESETS.find(
      (preset) => preset.w === layout.w && preset.h === layout.h
    ) ?? null
  );
}

export interface PublicLink {
  id: string;
  type: CreatorLinkType;
  title: string;
  url: string | null;
  description: string | null;
  icon: string | null;
  thumbnailUrl: string | null;
  layout: LinkLayout;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  coverImageUrl: string | null;
  productType: ProductType;
  salesCount: number;
}

export interface PublicProfile {
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  theme: ResolvedTheme;
  links: PublicLink[];
  products: PublicProduct[];
  /**
   * Whether the public page still carries the OpenLynk footer. Resolved from the owner's
   * plan rather than passed as a prop, so the page cannot be tricked into hiding the
   * attribution on a plan that has not paid for it.
   */
  showBranding: boolean;
}
