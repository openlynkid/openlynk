"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import { Spinner } from "@/components/ui/spinner";
import { Palette, Save, Check, Globe, Lock } from "lucide-react";

interface ThemePreset {
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

interface ProfileResponse {
  profile?: {
    username: string;
    displayName: string;
    theme: { preset?: string; background?: string; accentColor?: string };
    customDomain: string | null;
    isPublished: boolean;
  };
  entitlements?: {
    planId: string;
    customDomain: boolean;
    customTheme: boolean;
    removeBranding: boolean;
  };
  error?: string;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A miniature of the creator's page, so a preset choice is visible before saving. */
function ThemePreview({ preset }: { preset: ThemePreset }) {
  const radius = { none: "rounded-none", md: "rounded-md", full: "rounded-full" }[
    preset.buttonRadius
  ];
  const surface =
    preset.buttonStyle === "outline"
      ? { borderColor: preset.accentColor, color: preset.textColor, backgroundColor: "transparent" }
      : preset.buttonStyle === "soft"
        ? { backgroundColor: `${preset.accentColor}22`, color: preset.textColor }
        : { backgroundColor: preset.accentColor, color: preset.background };

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border border-border/70 p-3"
      style={{ backgroundColor: preset.background, color: preset.textColor }}
    >
      <div
        className="size-8 rounded-full"
        style={{ backgroundColor: preset.accentColor }}
        aria-hidden
      />
      <div className="h-2 w-16 rounded-full opacity-30" style={{ backgroundColor: preset.textColor }} />
      <div
        className={`w-full border px-2 py-1 text-center text-[10px] font-medium ${radius}`}
        style={surface}
      >
        My link
      </div>
      <div
        className={`w-full border px-2 py-1 text-center text-[10px] font-medium ${radius}`}
        style={surface}
      >
        Another link
      </div>
    </div>
  );
}

export function AppearanceClient() {
  const [presets, setPresets] = useState<ThemePreset[]>([]);
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [accentColor, setAccentColor] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<ProfileResponse["entitlements"] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingTheme, setIsSavingTheme] = useState(false);
  const [isSavingDomain, setIsSavingDomain] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [presetsRes, profileRes] = await Promise.all([
        fetch("/api/creator/theme"),
        fetch("/api/creator/profile"),
      ]);
      const presetsData = (await presetsRes.json()) as { presets?: ThemePreset[]; error?: string };
      const profileData = (await profileRes.json()) as ProfileResponse;

      if (!presetsRes.ok) throw new Error(presetsData.error ?? "Could not load theme presets.");
      if (!profileRes.ok) throw new Error(profileData.error ?? "Could not load your page.");

      setPresets(presetsData.presets ?? []);
      setEntitlements(profileData.entitlements ?? null);
      setSelectedPreset(profileData.profile?.theme.preset ?? "default");
      setAccentColor(profileData.profile?.theme.accentColor ?? "");
      setSavedDomain(profileData.profile?.customDomain ?? null);
      setCustomDomain(profileData.profile?.customDomain ?? "");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your appearance.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function saveTheme() {
    setIsSavingTheme(true);
    try {
      const theme: Record<string, string> = { preset: selectedPreset };
      if (entitlements?.customTheme && HEX.test(accentColor)) {
        theme.accentColor = accentColor;
      }

      const res = await fetch("/api/creator/theme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = (await res.json()) as {
        error?: string;
        resolvedTheme?: { accentColor: string };
      };
      if (!res.ok) throw new Error(data.error ?? "Could not save your theme.");

      // The server strips custom colours on a plan that does not allow them, so the
      // input is re-synced from what was actually stored rather than what was typed.
      setAccentColor(data.resolvedTheme?.accentColor ?? "");
      toast.success("Appearance saved. Your page is updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your theme.");
    } finally {
      setIsSavingTheme(false);
    }
  }

  async function saveDomain() {
    setIsSavingDomain(true);
    try {
      const res = await fetch("/api/creator/domain", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: customDomain.trim() || null }),
      });
      const data = (await res.json()) as ProfileResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not save your domain.");

      setSavedDomain(data.profile?.customDomain ?? null);
      setCustomDomain(data.profile?.customDomain ?? "");
      toast.success(
        data.profile?.customDomain
          ? "Domain saved. Point its DNS at OpenLynk to finish setup."
          : "Custom domain removed."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your domain.");
    } finally {
      setIsSavingDomain(false);
    }
  }

  const canCustomTheme = Boolean(entitlements?.customTheme);
  const canCustomDomain = Boolean(entitlements?.customDomain);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Appearance"
        description="Pick a theme, set your accent colour, and connect your own domain."
        tag="openlynk"
        category="Storefront editor"
      >
        <Badge variant="outline" className="font-mono capitalize">
          {entitlements?.planId ?? "free"} plan
        </Badge>
      </PageHeader>

      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <Skeleton className="h-96 w-full rounded-xl" />
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load your appearance</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{loadError}</span>
            <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit">
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-6">
            <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
              <FramePanel className="flex flex-col gap-4">
                <FrameHeader className="flex flex-row items-center justify-between p-0">
                  <div>
                    <FrameTitle className="text-base font-bold">Theme preset</FrameTitle>
                    <FrameDescription className="text-xs">
                      A preset sets the colours, button shape, and typeface together.
                    </FrameDescription>
                  </div>
                  <Palette className="size-4 text-muted-foreground" />
                </FrameHeader>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {presets.map((preset) => {
                    const isSelected = selectedPreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedPreset(preset.id)}
                        aria-pressed={isSelected}
                        className={`flex flex-col gap-3 rounded-xl border p-3 text-left transition-colors ${
                          isSelected
                            ? "border-foreground/60 ring-2 ring-foreground/20"
                            : "border-border/70 hover:border-foreground/30"
                        }`}
                      >
                        <ThemePreview preset={preset} />
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{preset.name}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {preset.description}
                            </p>
                          </div>
                          {isSelected && <Check className="size-4 shrink-0" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 border-t border-border/70 pt-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="accent-color" className="text-xs">
                      Accent colour
                    </Label>
                    {!canCustomTheme && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Lock className="size-3" />
                        Pro
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="accent-color"
                      type="color"
                      value={HEX.test(accentColor) ? accentColor : "#111827"}
                      onChange={(event) => setAccentColor(event.target.value)}
                      disabled={!canCustomTheme}
                      className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Accent colour"
                    />
                    <Input
                      value={accentColor}
                      onChange={(event) => setAccentColor(event.target.value)}
                      placeholder="#111827"
                      disabled={!canCustomTheme}
                      className="font-mono"
                      maxLength={7}
                    />
                  </div>
                  {!canCustomTheme && (
                    <p className="text-[11px] text-muted-foreground">
                      Custom colours are a Pro feature. Preset colours still apply on any plan.
                    </p>
                  )}
                </div>

                <Button onClick={() => void saveTheme()} disabled={isSavingTheme} className="w-fit">
                  {isSavingTheme ? (
                    <>
                      <Spinner className="size-4" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      Save appearance
                    </>
                  )}
                </Button>
              </FramePanel>
            </Frame>
          </div>

          <div className="flex flex-col gap-6">
            <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
              <FramePanel className="flex flex-col gap-4">
                <FrameHeader className="flex flex-row items-center justify-between p-0">
                  <div>
                    <FrameTitle className="text-base font-bold">Custom domain</FrameTitle>
                    <FrameDescription className="text-xs">
                      Serve your page from your own hostname.
                    </FrameDescription>
                  </div>
                  {!canCustomDomain && (
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      <Lock className="size-3" />
                      Pro
                    </Badge>
                  )}
                </FrameHeader>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="custom-domain" className="text-xs">
                    Domain
                  </Label>
                  <Input
                    id="custom-domain"
                    value={customDomain}
                    onChange={(event) => setCustomDomain(event.target.value)}
                    placeholder="links.yourname.com"
                    disabled={!canCustomDomain}
                  />
                  {savedDomain && (
                    <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Globe className="size-3" />
                      Currently serving on <code className="font-mono">{savedDomain}</code>
                    </p>
                  )}
                </div>

                <Button
                  variant="outline"
                  onClick={() => void saveDomain()}
                  disabled={isSavingDomain || !canCustomDomain}
                  className="w-fit"
                >
                  {isSavingDomain ? (
                    <>
                      <Spinner className="size-4" />
                      Saving…
                    </>
                  ) : (
                    "Save domain"
                  )}
                </Button>

                {!canCustomDomain && (
                  <p className="text-[11px] text-muted-foreground">
                    Custom domains are available on the Pro plan and above.
                  </p>
                )}
              </FramePanel>
            </Frame>

            <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
              <FramePanel className="flex flex-col gap-2">
                <FrameTitle className="text-sm font-bold">OpenLynk badge</FrameTitle>
                <p className="text-xs text-muted-foreground">
                  {entitlements?.removeBranding
                    ? "Your plan hides the “Made with OpenLynk” badge from your page."
                    : "Your page shows a “Made with OpenLynk” badge. Pro removes it."}
                </p>
              </FramePanel>
            </Frame>
          </div>
        </div>
      )}
    </div>
  );
}
