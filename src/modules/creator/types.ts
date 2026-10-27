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

export type CreatorLinkType = "link" | "header" | "divider";
export type ProductDeliveryType = "file" | "link" | "code";
export type ProductType = "digital" | "ebook" | "course" | "membership";

export const PRODUCT_TYPES: ProductType[] = ["digital", "ebook", "course", "membership"];
export const DELIVERY_TYPES: ProductDeliveryType[] = ["file", "link", "code"];

export interface PublicLink {
  id: string;
  type: CreatorLinkType;
  title: string;
  url: string | null;
  description: string | null;
  icon: string | null;
  thumbnailUrl: string | null;
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
