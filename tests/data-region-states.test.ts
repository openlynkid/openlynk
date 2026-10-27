import "./test-env.ts";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * ReUI requires every data region to own three states: empty (with an action),
 * loading (a `Skeleton` in the real layout, not a centred spinner) and error
 * (inline, with Retry). Nothing else enforces that, so a refactor can drop a
 * state and still typecheck, lint and build. This table names each region and
 * the markers that must survive in its source.
 *
 * Scope note: this is a source-presence guard, not a render test. It proves the
 * states are still written, not that they paint; the Node test runner here has
 * no JSX transform and the repo has no DOM test harness, so a rendered-DOM
 * assertion is not available. Runtime behaviour is verified by hand instead.
 */
interface DataRegion {
  name: string;
  file: string;
  /** Empty state: the message and its primary action. */
  empty?: { message: RegExp; action: RegExp };
  /**
   * Anchored on the region's own loading branch, so a Skeleton that belongs to a
   * different region in the same file cannot satisfy it. Omitted when a parent
   * region owns this view's loading state.
   */
  loading?: RegExp;
  error?: RegExp;
  retry?: RegExp;
}

const REGIONS: DataRegion[] = [
  {
    name: "Billing: current subscription overview",
    file: "src/app/dashboard/billing/billing-client.tsx",
    empty: { message: /free default plan/i, action: /Select Plan/ },
    loading: /isLoadingSub \? \([\s\S]{0,600}?<Skeleton/,
    error: /Could not load subscription/,
    retry: /setReloadKey/,
  },
  {
    name: "Organizations: your workspaces list",
    file: "src/app/dashboard/organizations/organizations-client.tsx",
    empty: { message: /No workspaces yet/, action: /Create organization/ },
    loading: /isListLoading \? \([\s\S]{0,600}?<Skeleton/,
    error: /Could not load your workspaces/,
    retry: /refetchList/,
  },
  {
    name: "Organizations: team members grid",
    file: "src/app/dashboard/organizations/organizations-client.tsx",
    empty: { message: /No members yet/, action: /Invite a teammate/ },
    loading: /isMembersLoading \? \([\s\S]{0,600}?<Skeleton/,
    error: /Could not load members/,
    retry: /setReloadKey/,
  },
  {
    // A filtered view of the grid above: the parent renders the Skeleton while the
    // roster loads, so this region only owns its own empty state.
    name: "Organizations: members grid, no search results",
    file: "src/components/organization-members-data-grid.tsx",
    empty: { message: /No members match your search/, action: /Clear search/ },
  },
  {
    // A single-object region, so it has no empty state; loading, error and retry
    // are the ones that apply.
    name: "Settings: session-backed account details",
    file: "src/app/dashboard/settings/settings-client.tsx",
    loading: /isPending \? \([\s\S]{0,600}?<Skeleton/,
    error: /Could not load your account/,
    retry: /refetch\(\)/,
  },
];

/** The loading branch must be a layout-shaped Skeleton, never a lone spinner. */
const SPINNER_ONLY_LOADING =
  /(isPending|isListLoading|isMembersLoading|isLoadingSub) \? \(\s*<div[^>]*>\s*<Loader2[^>]*animate-spin/;

const check = (source: string, pattern: RegExp | undefined, file: string, what: string) => {
  if (!pattern) return;
  assert.ok(pattern.test(source), `${file}: ${what} is missing (expected ${pattern})`);
};

describe("Data region states (ReUI: empty + loading + error)", () => {
  for (const region of REGIONS) {
    it(`${region.name} keeps its states`, () => {
      const source = readFileSync(path.join(repoRoot, region.file), "utf8");

      check(source, region.loading, region.file, "loading state (Skeleton)");
      check(source, region.error, region.file, "error state");
      check(source, region.retry, region.file, "retry affordance");

      if (region.empty) {
        check(source, region.empty.message, region.file, "empty-state message");
        check(source, region.empty.action, region.file, "empty-state action");
      }

      assert.doesNotMatch(
        source,
        SPINNER_ONLY_LOADING,
        `${region.file}: loading state is a bare spinner, not a Skeleton in the real layout`
      );
    });
  }
});
