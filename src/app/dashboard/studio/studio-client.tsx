"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/reui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Link2,
  Minus,
  Pencil,
  Plus,
  Smartphone,
  Monitor,
  Trash2,
  Type,
  AlignLeft,
} from "lucide-react";
import { BENTO_GRID_CLASS, tileSpanClass } from "@/components/storefront/bento";

type TileType = "link" | "header" | "divider" | "text" | "image";

interface TileLayout {
  w: number;
  h: number;
}

interface StudioTile {
  id: string;
  type: TileType;
  title: string;
  url: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  isActive: boolean;
  clickCount: number;
  layout: TileLayout;
}

interface SizePreset {
  id: string;
  name: string;
  w: number;
  h: number;
}

interface StudioResponse {
  tiles?: StudioTile[];
  sizePresets?: SizePreset[];
  entitlements?: { maxLinks: number | null; planId: string };
  error?: string;
}

const TYPE_LABEL: Record<TileType, string> = {
  link: "Link",
  header: "Header",
  divider: "Divider",
  text: "Text",
  image: "Image",
};

const TYPE_ICON: Record<TileType, React.ComponentType<{ className?: string }>> = {
  link: Link2,
  header: Type,
  divider: Minus,
  text: AlignLeft,
  image: ImageIcon,
};

/**
 * The footprint a new tile starts at, per kind.
 *
 * A link is a full-width bar, so it starts as one. A text or image tile is content that
 * reads well beside another, so it starts at half width — the creator is arranging a
 * grid, and landing every tile full-width would make the first drag the whole job.
 */
const DEFAULT_LAYOUT_FOR_TYPE: Record<TileType, TileLayout> = {
  link: { w: 4, h: 1 },
  header: { w: 4, h: 1 },
  divider: { w: 4, h: 1 },
  text: { w: 2, h: 1 },
  image: { w: 2, h: 2 },
};

/** A miniature of the footprint a size preset produces. */
function TileShape({ preset, active }: { preset: SizePreset; active: boolean }) {
  const width = (preset.w / 4) * 100;
  const height = (preset.h / 2) * 100;
  return (
    <span className="flex size-9 items-center justify-center" aria-hidden>
      <span
        className={`rounded-sm border ${active ? "border-primary bg-primary/15" : "border-border bg-muted"}`}
        style={{ width: `${width}%`, height: `${height}%` }}
      />
    </span>
  );
}

/** One tile on the canvas. Its own component so dnd-kit can own the refs it needs. */
function SortableTile({
  tile,
  selected,
  onSelect,
  onMove,
  onToggleActive,
  index,
  total,
}: {
  tile: StudioTile;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onToggleActive: (id: string) => void;
  index: number;
  total: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tile.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = TYPE_ICON[tile.type];
  const span = tile.type === "header" || tile.type === "divider" ? "col-span-4" : tileSpanClass(tile.layout);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${span} group relative flex min-w-0 flex-col justify-between overflow-hidden rounded-lg border bg-card p-3 ${
        selected ? "border-primary ring-2 ring-ring/40" : "border-border/70"
      } ${isDragging ? "opacity-60" : ""} ${tile.isActive ? "" : "opacity-50"}`}
    >
      {/* The title doubles as the edit affordance: a real button, so the tile is
          reachable by keyboard without nesting buttons inside a clickable region. */}
      <button
        type="button"
        onClick={() => onSelect(tile.id)}
        aria-pressed={selected}
        aria-label={`Edit ${tile.title || TYPE_LABEL[tile.type]}`}
        className="flex min-w-0 items-start justify-between gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate text-sm font-medium">
            {tile.title || TYPE_LABEL[tile.type]}
          </span>
        </span>
        {!tile.isActive && <Badge variant="outline">Hidden</Badge>}
      </button>

      {tile.type === "link" && tile.url && (
        <p className="pointer-events-none relative truncate text-xs text-muted-foreground">
          {tile.url}
        </p>
      )}
      {tile.type === "text" && tile.description && (
        <p className="pointer-events-none relative line-clamp-2 text-xs text-muted-foreground">
          {tile.description}
        </p>
      )}
      {(tile.type === "image" || tile.thumbnailUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tile.type === "image" ? (tile.url ?? "") : (tile.thumbnailUrl ?? "")}
          alt=""
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-20"
        />
      )}

      <div className="relative mt-2 flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${tile.title || TYPE_LABEL[tile.type]}`}
          className="cursor-grab text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="size-4" />
        </button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onMove(tile.id, -1)}
          disabled={index === 0}
          aria-label={`Move ${tile.title || TYPE_LABEL[tile.type]} earlier`}
        >
          <ArrowLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onMove(tile.id, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${tile.title || TYPE_LABEL[tile.type]} later`}
        >
          <ArrowRight className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onToggleActive(tile.id)}
          aria-label={tile.isActive ? `Hide ${tile.title}` : `Show ${tile.title}`}
        >
          {tile.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
      </div>
    </div>
  );
}

export function StudioClient() {
  const [tiles, setTiles] = useState<StudioTile[]>([]);
  const [sizePresets, setSizePresets] = useState<SizePreset[]>([]);
  const [maxLinks, setMaxLinks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"mobile" | "desktop">("desktop");
  const [pendingDelete, setPendingDelete] = useState<StudioTile | null>(null);

  // Inspector content form. Shared by "add" and "edit"; `editingId` picks the mode.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<TileType>("link");
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingTile, setIsSavingTile] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/creator/studio");
      const data = (await res.json()) as StudioResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not load your studio.");
      setTiles(data.tiles ?? []);
      setSizePresets(data.sizePresets ?? []);
      setMaxLinks(data.entitlements?.maxLinks ?? null);
      setIsDirty(false);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your studio.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const selectedTile = tiles.find((tile) => tile.id === selectedId) ?? null;
  const limitReached = maxLinks !== null && tiles.length >= maxLinks;

  function resetForm() {
    setEditingId(null);
    setFormType("link");
    setFormTitle("");
    setFormUrl("");
    setFormDescription("");
    setFormError(null);
  }

  function startEdit(tile: StudioTile) {
    setSelectedId(tile.id);
    setEditingId(tile.id);
    setFormType(tile.type);
    setFormTitle(tile.title);
    setFormUrl(tile.url ?? "");
    setFormDescription(tile.description ?? "");
    setFormError(null);
  }

  function selectTile(id: string) {
    setSelectedId(id);
    const tile = tiles.find((candidate) => candidate.id === id);
    if (tile) startEdit(tile);
  }

  /** Resizes a tile locally; the change is persisted by Save layout. */
  function applyPreset(preset: SizePreset) {
    if (!selectedTile) return;
    setTiles((current) =>
      current.map((tile) =>
        tile.id === selectedTile.id ? { ...tile, layout: { w: preset.w, h: preset.h } } : tile
      )
    );
    setIsDirty(true);
  }

  function moveTile(id: string, direction: -1 | 1) {
    setTiles((current) => {
      const index = current.findIndex((tile) => tile.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      return arrayMove(current, index, target);
    });
    setIsDirty(true);
  }

  function toggleActive(id: string) {
    setTiles((current) =>
      current.map((tile) => (tile.id === id ? { ...tile, isActive: !tile.isActive } : tile))
    );
    setIsDirty(true);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTiles((current) => {
      const oldIndex = current.findIndex((tile) => tile.id === active.id);
      const newIndex = current.findIndex((tile) => tile.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setIsDirty(true);
  }

  async function saveLayout() {
    setIsSavingLayout(true);
    try {
      const res = await fetch("/api/creator/studio", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: tiles.map((tile) => ({
            id: tile.id,
            layout: tile.layout,
            isActive: tile.isActive,
          })),
        }),
      });
      const data = (await res.json()) as StudioResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not save your layout.");
      // Take the server's copy: it clamps spans, so the canvas shows what was stored
      // rather than an optimistic value the server may have adjusted.
      if (data.tiles) setTiles(data.tiles);
      setIsDirty(false);
      toast.success("Layout saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your layout.");
    } finally {
      setIsSavingLayout(false);
    }
  }

  async function handleTileSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const needsUrl = formType === "link" || formType === "image";
    if (needsUrl && formUrl.trim().length === 0) {
      setFormError(formType === "image" ? "An image needs a URL." : "A link needs a destination URL.");
      return;
    }
    if (formType !== "divider" && formType !== "text" && formTitle.trim().length === 0) {
      setFormError("Give this tile a title.");
      return;
    }
    if (formType === "text" && formTitle.trim().length === 0 && formDescription.trim().length === 0) {
      setFormError("A text tile needs some text.");
      return;
    }

    setIsSavingTile(true);
    try {
      const payload = {
        type: formType,
        title: formTitle,
        url: needsUrl ? formUrl : null,
        description: formDescription.trim() ? formDescription : null,
      };
      const res = await fetch(
        editingId ? `/api/creator/links/${editingId}` : "/api/creator/links",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            editingId ? payload : { ...payload, layout: DEFAULT_LAYOUT_FOR_TYPE[formType] }
          ),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save this tile.");

      toast.success(editingId ? "Tile updated." : "Tile added to your page.");
      resetForm();
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this tile.");
    } finally {
      setIsSavingTile(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/creator/links/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete this tile.");
      }
      toast.success("Tile removed.");
      if (selectedId === target.id) {
        setSelectedId(null);
        resetForm();
      }
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this tile.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Bento Studio"
        description="Lay your page out as a bento grid. Resize each tile, then drag to arrange them."
        tag="openlynk"
        category="Bento builder"
      >
        <div className="flex items-center gap-1 rounded-lg border border-border/70 p-0.5">
          <Button
            variant={viewport === "mobile" ? "default" : "ghost"}
            size="icon-sm"
            aria-pressed={viewport === "mobile"}
            onClick={() => setViewport("mobile")}
            aria-label="Preview as a phone"
          >
            <Smartphone className="size-3.5" />
          </Button>
          <Button
            variant={viewport === "desktop" ? "default" : "ghost"}
            size="icon-sm"
            aria-pressed={viewport === "desktop"}
            onClick={() => setViewport("desktop")}
            aria-label="Preview as a desktop"
          >
            <Monitor className="size-3.5" />
          </Button>
        </div>
        <Button
          size="sm"
          onClick={() => void saveLayout()}
          disabled={isSavingLayout || !isDirty}
          className="text-xs font-semibold"
        >
          {isSavingLayout ? <Spinner className="size-4" /> : <Pencil className="size-3.5" />}
          Save layout
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <div>
                <FrameTitle>Canvas</FrameTitle>
                <FrameDescription>
                  The grid here is the page your visitors see.
                </FrameDescription>
              </div>
              <div className="flex items-center gap-2">
                {isDirty && (
                  <Badge variant="warning-light" className="font-mono">
                    Unsaved
                  </Badge>
                )}
                <Badge variant="outline" className="font-mono">
                  {maxLinks === null ? `${tiles.length} tiles` : `${tiles.length} / ${maxLinks}`}
                </Badge>
              </div>
            </FrameHeader>

            {isLoading ? (
              <div className={BENTO_GRID_CLASS}>
                <Skeleton className="col-span-4 h-16 rounded-lg" />
                <Skeleton className="col-span-2 h-16 rounded-lg" />
                <Skeleton className="col-span-2 h-16 rounded-lg" />
                <Skeleton className="col-span-4 h-24 rounded-lg" />
              </div>
            ) : loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load your studio</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{loadError}</span>
                  <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : tiles.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <GripVertical className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Your page has no tiles yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add your first tile and start arranging your bento.
                  </p>
                </div>
                <Button size="sm" onClick={resetForm} className="text-xs font-semibold">
                  <Plus className="size-3.5" />
                  Add your first tile
                </Button>
              </div>
            ) : (
              // The phone/desktop toggle changes the canvas width. Width is a layout
              // property, so it snaps rather than animates — C1 forbids transitioning it.
              <div
                className={`mx-auto w-full ${
                  viewport === "mobile" ? "max-w-sm" : "max-w-full"
                }`}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={tiles.map((tile) => tile.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className={BENTO_GRID_CLASS}>
                      {tiles.map((tile, index) => (
                        <SortableTile
                          key={tile.id}
                          tile={tile}
                          selected={tile.id === selectedId}
                          onSelect={selectTile}
                          onMove={moveTile}
                          onToggleActive={toggleActive}
                          index={index}
                          total={tiles.length}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </FramePanel>
        </Frame>

        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <div>
                <FrameTitle>
                  {editingId ? "Tile settings" : "Add a tile"}
                </FrameTitle>
                <FrameDescription>
                  {editingId
                    ? "Change the content or the footprint."
                    : "Pick a kind, then place it on the grid."}
                </FrameDescription>
              </div>
              {editingId && (
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs">
                  Cancel
                </Button>
              )}
            </FrameHeader>

            {selectedTile && (
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Tile size</Label>
                <div className="grid grid-cols-4 gap-2">
                  {sizePresets.map((preset) => {
                    const active =
                      preset.w === selectedTile.layout.w && preset.h === selectedTile.layout.h;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        aria-pressed={active}
                        aria-label={`${preset.name} tile`}
                        className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-[10px] transition-colors ${
                          active
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border/70 text-muted-foreground hover:bg-muted/50"
                        }`}
                      >
                        <TileShape preset={preset} active={active} />
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
                <label className="flex items-center gap-2 pt-1 text-xs">
                  <Checkbox
                    checked={selectedTile.isActive}
                    onCheckedChange={() => toggleActive(selectedTile.id)}
                  />
                  Show this tile on my page
                </label>
              </div>
            )}

            <form onSubmit={handleTileSubmit} className="flex flex-col gap-4">
              {formError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="tile-type" className="text-xs">
                  Tile kind
                </Label>
                <Select
                  value={formType}
                  onValueChange={(value) => setFormType(value as TileType)}
                  disabled={Boolean(editingId)}
                >
                  <SelectTrigger id="tile-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="image">Image</SelectItem>
                    <SelectItem value="header">Section header</SelectItem>
                    <SelectItem value="divider">Divider</SelectItem>
                  </SelectContent>
                </Select>
                {editingId && (
                  <p className="text-xs text-muted-foreground">
                    Delete this tile and add a new one to change its kind.
                  </p>
                )}
              </div>

              {formType !== "divider" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tile-title" className="text-xs">
                    {formType === "text" ? "Heading (optional)" : "Title"}
                  </Label>
                  <Input
                    id="tile-title"
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder={formType === "header" ? "Follow me" : "My latest video"}
                    maxLength={120}
                  />
                </div>
              )}

              {(formType === "link" || formType === "image") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tile-url" className="text-xs">
                    {formType === "image" ? "Image URL" : "URL"}
                  </Label>
                  <Input
                    id="tile-url"
                    value={formUrl}
                    onChange={(event) => setFormUrl(event.target.value)}
                    placeholder={
                      formType === "image"
                        ? "https://example.com/cover.jpg"
                        : "https://example.com"
                    }
                    inputMode="url"
                  />
                </div>
              )}

              {(formType === "text" || formType === "link" || formType === "image") && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tile-description" className="text-xs">
                    {formType === "text" ? "Text" : "Description (optional)"}
                  </Label>
                  <Textarea
                    id="tile-description"
                    value={formDescription}
                    onChange={(event) => setFormDescription(event.target.value)}
                    placeholder={
                      formType === "text"
                        ? "A short note for your visitors."
                        : "One line about this tile."
                    }
                    maxLength={300}
                    rows={3}
                  />
                </div>
              )}

              <Button type="submit" disabled={isSavingTile || (!editingId && limitReached)}>
                {isSavingTile ? (
                  <>
                    <Spinner className="size-4" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    {editingId ? "Save tile" : "Add tile"}
                  </>
                )}
              </Button>

              {limitReached && !editingId && (
                <p className="text-xs text-muted-foreground">
                  Your plan&apos;s tile limit is reached. Upgrade on the Billing page to add more.
                </p>
              )}

              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive hover:text-destructive"
                  onClick={() => setPendingDelete(selectedTile)}
                >
                  <Trash2 className="size-3.5" />
                  Delete tile
                </Button>
              )}
            </form>
          </FramePanel>
        </Frame>
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tile?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; will be removed from your page. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="text-xs text-muted-foreground">
        Your page is public at <code className="font-mono">/u/your-handle</code> — change the
        handle under Profile &amp; Settings.
      </p>
    </div>
  );
}
