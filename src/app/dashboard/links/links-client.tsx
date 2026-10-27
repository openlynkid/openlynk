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
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Link2,
  Minus,
  Pencil,
  Plus,
  Trash2,
  Type,
} from "lucide-react";

interface CreatorLink {
  id: string;
  type: "link" | "header" | "divider";
  title: string;
  url: string | null;
  isActive: boolean;
  clickCount: number;
}

interface LinksResponse {
  links?: CreatorLink[];
  error?: string;
}

const TYPE_LABEL: Record<CreatorLink["type"], string> = {
  link: "Link",
  header: "Header",
  divider: "Divider",
};

const TYPE_ICON: Record<CreatorLink["type"], React.ComponentType<{ className?: string }>> = {
  link: Link2,
  header: Type,
  divider: Minus,
};

/** One sortable row. Its own component so dnd-kit can own the refs it needs. */
function SortableRow({
  link,
  onEdit,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  link: CreatorLink;
  onEdit: (link: CreatorLink) => void;
  onDelete: (link: CreatorLink) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: link.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const Icon = TYPE_ICON[link.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      {/* Pointer and keyboard dragging both go through dnd-kit, so the handle carries the
          listeners while the row's own buttons stay clickable. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${link.title}`}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{link.title}</span>
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABEL[link.type]}
          </Badge>
          {!link.isActive && (
            <Badge variant="secondary" className="text-[10px]">
              Hidden
            </Badge>
          )}
        </div>
        {link.url && <p className="truncate text-xs text-muted-foreground">{link.url}</p>}
      </div>

      {link.type === "link" && (
        <span className="hidden shrink-0 text-xs text-muted-foreground tabular-nums sm:inline">
          {link.clickCount} clicks
        </span>
      )}

      <div className="flex shrink-0 items-center gap-1">
        {/* Explicit up/down buttons as well as drag: reordering is the whole point of this
            page, and drag-and-drop alone is unreachable by keyboard. */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(link.id, -1)}
          disabled={isFirst}
          aria-label={`Move ${link.title} up`}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(link.id, 1)}
          disabled={isLast}
          aria-label={`Move ${link.title} down`}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(link)}
          aria-label={`Edit ${link.title}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(link)}
          aria-label={`Delete ${link.title}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function LinksClient() {
  const [links, setLinks] = useState<CreatorLink[]>([]);
  const [maxLinks, setMaxLinks] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CreatorLink | null>(null);
  const [editing, setEditing] = useState<CreatorLink | null>(null);

  const [formType, setFormType] = useState<CreatorLink["type"]>("link");
  const [formTitle, setFormTitle] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/creator/links");
      const data = (await res.json()) as LinksResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not load your links.");
      setLinks(data.links ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your links.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
    void fetch("/api/creator/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entitlements?: { maxLinks: number | null } } | null) => {
        if (data?.entitlements) setMaxLinks(data.entitlements.maxLinks);
      })
      .catch(() => {});
  }, [load]);

  const limitReached = maxLinks !== null && links.length >= maxLinks;

  function resetForm() {
    setEditing(null);
    setFormType("link");
    setFormTitle("");
    setFormUrl("");
    setFormError(null);
  }

  function startEdit(link: CreatorLink) {
    setEditing(link);
    setFormType(link.type);
    setFormTitle(link.title);
    setFormUrl(link.url ?? "");
    setFormError(null);
  }

  async function persistOrder(next: CreatorLink[]) {
    setLinks(next);
    try {
      const res = await fetch("/api/creator/links", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((link) => link.id) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save the new order.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the new order.");
      // Reload rather than keep an optimistic order the server rejected.
      await load();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex((link) => link.id === active.id);
    const newIndex = links.findIndex((link) => link.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(links, oldIndex, newIndex));
  }

  function handleMove(id: string, direction: -1 | 1) {
    const index = links.findIndex((link) => link.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= links.length) return;
    void persistOrder(arrayMove(links, index, target));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    if (formType !== "divider" && formTitle.trim().length === 0) {
      setFormError("Give this a title so visitors know what it is.");
      return;
    }
    if (formType === "link" && formUrl.trim().length === 0) {
      setFormError("A link needs a destination URL.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(editing ? `/api/creator/links/${editing.id}` : "/api/creator/links", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formType,
          title: formTitle,
          url: formType === "link" ? formUrl : null,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save this item.");

      toast.success(editing ? "Block updated." : "Block added to your page.");
      resetForm();
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this item.");
    } finally {
      setIsSaving(false);
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
        throw new Error(data.error ?? "Could not delete this block.");
      }
      toast.success("Block removed.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this block.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Links & Blocks"
        description="Arrange the blocks on your page. Drag to reorder, or use the arrow buttons."
        tag="openlynk"
        category="Storefront editor"
      >
        <Badge variant="outline" className="font-mono">
          {maxLinks === null ? `${links.length} / unlimited` : `${links.length} / ${maxLinks}`}
        </Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <div>
                <FrameTitle className="text-base font-bold">Page blocks</FrameTitle>
                <FrameDescription className="text-xs">
                  The order here is the order visitors see.
                </FrameDescription>
              </div>
              <Badge variant="outline" className="font-mono">
                {links.length} items
              </Badge>
            </FrameHeader>

            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load your page</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{loadError}</span>
                  <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : links.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Link2 className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">Your page is empty</p>
                  <p className="text-xs text-muted-foreground">
                    Add your first block to start sharing your page.
                  </p>
                </div>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={links.map((link) => link.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {links.map((link, index) => (
                      <SortableRow
                        key={link.id}
                        link={link}
                        onEdit={startEdit}
                        onDelete={setPendingDelete}
                        onMove={handleMove}
                        isFirst={index === 0}
                        isLast={index === links.length - 1}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </FramePanel>
        </Frame>

        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <FrameTitle className="text-base font-bold">
                {editing ? "Edit block" : "Add a block"}
              </FrameTitle>
              {editing && (
                <Button variant="ghost" size="sm" onClick={resetForm} className="text-xs">
                  Cancel
                </Button>
              )}
            </FrameHeader>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {formError && (
                <Alert variant="destructive">
                  <AlertTitle>Could not save</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="block-type" className="text-xs">
                  Block type
                </Label>
                <Select
                  value={formType}
                  onValueChange={(value) => setFormType(value as CreatorLink["type"])}
                  disabled={Boolean(editing)}
                >
                  <SelectTrigger id="block-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="link">Link</SelectItem>
                    <SelectItem value="header">Section header</SelectItem>
                    <SelectItem value="divider">Divider</SelectItem>
                  </SelectContent>
                </Select>
                {editing && (
                  <p className="text-[11px] text-muted-foreground">
                    Delete this block and add a new one to change its type.
                  </p>
                )}
              </div>

              {formType !== "divider" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="block-title" className="text-xs">
                    Title
                  </Label>
                  <Input
                    id="block-title"
                    value={formTitle}
                    onChange={(event) => setFormTitle(event.target.value)}
                    placeholder={formType === "header" ? "Follow me" : "My latest video"}
                    maxLength={120}
                  />
                </div>
              )}

              {formType === "link" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="block-url" className="text-xs">
                    URL
                  </Label>
                  <Input
                    id="block-url"
                    value={formUrl}
                    onChange={(event) => setFormUrl(event.target.value)}
                    placeholder="https://example.com"
                    inputMode="url"
                  />
                </div>
              )}

              <Button type="submit" disabled={isSaving || (limitReached && !editing)}>
                {isSaving ? (
                  <>
                    <Spinner className="size-4" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    {editing ? "Save changes" : "Add block"}
                  </>
                )}
              </Button>

              {limitReached && !editing && (
                <p className="text-xs text-muted-foreground">
                  Your plan&apos;s link limit is reached. Upgrade on the Billing page to add more.
                </p>
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
            <AlertDialogTitle>Delete this block?</AlertDialogTitle>
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
