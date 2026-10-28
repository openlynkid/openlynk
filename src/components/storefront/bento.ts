import { BENTO_GRID_COLUMNS, type LinkLayout } from "@/modules/creator/types";

/**
 * Bento grid classes, as a static map rather than a template string.
 *
 * Tailwind only sees classes that appear literally in the source, so `col-span-${w}`
 * would be purged and every tile would silently collapse to one column in production.
 * The map is exhaustive over `BENTO_GRID_COLUMNS` x `BENTO_MAX_ROWS`, which
 * `resolveTileLayout` guarantees a stored layout is clamped into.
 */
const COL_SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-2",
  3: "col-span-3",
  4: "col-span-4",
};

const ROW_SPAN: Record<number, string> = {
  1: "row-span-1",
  2: "row-span-2",
  3: "row-span-3",
};

/** The grid container. Rows are content-sized with a floor, so a tall tile can grow. */
export const BENTO_GRID_CLASS =
  "grid grid-cols-4 auto-rows-[minmax(4.5rem,auto)] grid-flow-dense gap-3";

/** The span classes for one tile. Falls back to a full-width row for an unknown span. */
export function tileSpanClass(layout: LinkLayout): string {
  const col = COL_SPAN[layout.w] ?? COL_SPAN[BENTO_GRID_COLUMNS];
  const row = ROW_SPAN[layout.h] ?? ROW_SPAN[1];
  return `${col} ${row}`;
}

/** Whether a tile is tall enough to hold a second line of content. */
export function isRoomyTile(layout: LinkLayout): boolean {
  return layout.h > 1 || layout.w >= 2;
}
