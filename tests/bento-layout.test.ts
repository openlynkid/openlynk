import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BENTO_GRID_COLUMNS,
  BENTO_MAX_ROWS,
  DEFAULT_TILE_LAYOUT,
  resolveTileLayout,
  tileSizePresetFor,
  TILE_SIZE_PRESETS,
} from "../src/modules/creator/types.ts";
import { validateLinkInput, CreatorValidationError } from "../src/modules/creator/service.ts";
import { tileSpanClass } from "../src/components/storefront/bento.ts";

/**
 * The bento grid is stored as data and rendered from a static class map, so the two
 * places a bad value could escape are the resolver (does a hostile row still render?)
 * and the validator (does the API accept a footprint the renderer cannot draw?).
 * Both are pure functions, so they are tested directly without a database.
 */

describe("Bento tile layout: resolveTileLayout", () => {
  it("returns the full-width default for a row written before the studio existed", () => {
    // `{}` is what the migration backfills, so this is the path every existing page takes.
    assert.deepEqual(resolveTileLayout({}), DEFAULT_TILE_LAYOUT);
    assert.deepEqual(resolveTileLayout(null), DEFAULT_TILE_LAYOUT);
    assert.deepEqual(resolveTileLayout(undefined), DEFAULT_TILE_LAYOUT);
  });

  it("clamps an oversized footprint to the grid instead of rejecting it", () => {
    assert.deepEqual(resolveTileLayout({ w: 99, h: 99 }), {
      w: BENTO_GRID_COLUMNS,
      h: BENTO_MAX_ROWS,
    });
  });

  it("clamps a zero or negative footprint up to one cell", () => {
    assert.deepEqual(resolveTileLayout({ w: 0, h: 0 }), { w: 1, h: 1 });
    assert.deepEqual(resolveTileLayout({ w: -5, h: -1 }), { w: 1, h: 1 });
  });

  it("rounds a fractional span to a whole cell", () => {
    assert.deepEqual(resolveTileLayout({ w: 2.4, h: 1.6 }), { w: 2, h: 2 });
  });

  it("falls back to the default when either span is missing or not a number", () => {
    assert.deepEqual(resolveTileLayout({ w: 2 } as { w: number }), DEFAULT_TILE_LAYOUT);
    assert.deepEqual(
      resolveTileLayout({ w: "2", h: 1 } as unknown as { w: number; h: number }),
      DEFAULT_TILE_LAYOUT
    );
  });
});

describe("Bento tile layout: size presets", () => {
  it("only offers presets the renderer has a span class for", () => {
    for (const preset of TILE_SIZE_PRESETS) {
      assert.ok(preset.w >= 1 && preset.w <= BENTO_GRID_COLUMNS, `${preset.id} width in range`);
      assert.ok(preset.h >= 1 && preset.h <= BENTO_MAX_ROWS, `${preset.id} height in range`);
    }
  });

  it("round-trips every preset through the resolver and back to a preset", () => {
    for (const preset of TILE_SIZE_PRESETS) {
      const resolved = resolveTileLayout(preset);
      assert.deepEqual(resolved, { w: preset.w, h: preset.h });
      assert.equal(tileSizePresetFor(resolved)?.id, preset.id);
    }
  });

  it("returns null for a footprint no preset matches", () => {
    assert.equal(tileSizePresetFor({ w: 1, h: 1 }), null);
  });
});

describe("Bento tiles: link validation for the new kinds", () => {
  const base = { title: "A tile" };

  it("accepts a text tile with only a body and no title", () => {
    const values = validateLinkInput({
      type: "text",
      title: "",
      description: "Just a paragraph.",
    });
    assert.equal(values.type, "text");
    assert.equal(values.description, "Just a paragraph.");
    assert.equal(values.layout.w, BENTO_GRID_COLUMNS);
  });

  it("rejects a text tile with neither a heading nor a body", () => {
    assert.throws(
      () => validateLinkInput({ type: "text", title: "", description: "" }),
      CreatorValidationError
    );
  });

  it("requires a safe URL for an image tile", () => {
    assert.throws(
      () => validateLinkInput({ type: "image", ...base, url: "" }),
      CreatorValidationError
    );
    assert.throws(
      () => validateLinkInput({ type: "image", ...base, url: "javascript:alert(1)" }),
      CreatorValidationError
    );
    const values = validateLinkInput({ type: "image", ...base, url: "https://cdn.test/a.jpg" });
    assert.equal(values.url, "https://cdn.test/a.jpg");
  });

  it("drops a URL on a kind that has no destination", () => {
    const values = validateLinkInput({
      type: "text",
      title: "Note",
      description: "Body",
      url: "https://evil.test",
    });
    assert.equal(values.url, null);
  });

  it("stores a supplied layout, resolved to whole cells", () => {
    const values = validateLinkInput({ type: "link", ...base, url: "https://a.test", layout: { w: 2, h: 2 } });
    assert.deepEqual(values.layout, { w: 2, h: 2 });
  });

  it("defaults the layout to a full-width row when none is supplied", () => {
    const values = validateLinkInput({ type: "link", ...base, url: "https://a.test" });
    assert.deepEqual(values.layout, DEFAULT_TILE_LAYOUT);
  });

  it("still refuses an unknown kind", () => {
    assert.throws(
      () => validateLinkInput({ type: "iframe" as "link", ...base }),
      CreatorValidationError
    );
  });
});

describe("Bento grid: renderer class map", () => {
  it("names the right span class for every footprint the grid allows", () => {
    for (let w = 1; w <= BENTO_GRID_COLUMNS; w += 1) {
      for (let h = 1; h <= BENTO_MAX_ROWS; h += 1) {
        const cls = tileSpanClass({ w, h });
        assert.ok(cls.includes(`col-span-${w}`), `w=${w} -> ${cls}`);
        assert.ok(cls.includes(`row-span-${h}`), `h=${h} -> ${cls}`);
      }
    }
  });

  it("keeps every span class as a literal in the source, so Tailwind cannot purge it", () => {
    // Tailwind only emits classes it can see in the source text. A `col-span-${w}`
    // template would compile, pass typecheck, and silently collapse every tile to one
    // column in production — this is the assertion that catches that.
    const source = readFileSync(
      new URL("../src/components/storefront/bento.ts", import.meta.url),
      "utf8"
    );
    for (let w = 1; w <= BENTO_GRID_COLUMNS; w += 1) {
      assert.ok(source.includes(`"col-span-${w}"`), `col-span-${w} must appear literally`);
    }
    for (let h = 1; h <= BENTO_MAX_ROWS; h += 1) {
      assert.ok(source.includes(`"row-span-${h}"`), `row-span-${h} must appear literally`);
    }
    assert.ok(source.includes("grid-cols-4"), "the grid width must appear literally");

    // Strip comments first: this file's own doc comment quotes the `col-span-${w}`
    // template as the thing not to do, and matching that would fail the guard.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.ok(!/col-span-\$\{/.test(code), "no interpolated span class");
    assert.ok(!/row-span-\$\{/.test(code), "no interpolated span class");
  });
});
