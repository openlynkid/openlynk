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
  ExternalLink,
  FileDown,
  GripVertical,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface CreatorProduct {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  deliveryType: "file" | "link" | "code";
  deliveryUrl: string | null;
  productType: string;
  isActive: boolean;
  salesCount: number;
  assets: { id: string; fileName: string; fileUrl: string }[];
}

interface ProductsResponse {
  products?: CreatorProduct[];
  error?: string;
}

const formatIDR = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);

function SortableProductRow({
  item,
  onEdit,
  onDelete,
  onMove,
  isFirst,
  isLast,
}: {
  item: CreatorProduct;
  onEdit: (item: CreatorProduct) => void;
  onDelete: (item: CreatorProduct) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3 ${
        isDragging ? "opacity-60 shadow-lg" : ""
      }`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${item.title}`}
        className="cursor-grab text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="size-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{item.title}</span>
          <Badge variant="outline" className="text-[10px] capitalize">
            {item.productType}
          </Badge>
          {!item.isActive && (
            <Badge variant="secondary" className="text-[10px]">
              Hidden
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 pt-0.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {item.price === 0 ? "Free" : formatIDR(item.price)}
          </span>
          <span className="tabular-nums">{item.salesCount} sold</span>
          <span className="inline-flex items-center gap-1">
            <FileDown className="size-3" />
            {item.deliveryType === "file"
              ? `${item.assets.length} file${item.assets.length === 1 ? "" : "s"}`
              : item.deliveryType}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(item.id, -1)}
          disabled={isFirst}
          aria-label={`Move ${item.title} up`}
        >
          <ArrowUp className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onMove(item.id, 1)}
          disabled={isLast}
          aria-label={`Move ${item.title} down`}
        >
          <ArrowDown className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit(item)}
          aria-label={`Edit ${item.title}`}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onDelete(item)}
          aria-label={`Delete ${item.title}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function ProductsClient() {
  const [products, setProducts] = useState<CreatorProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CreatorProduct | null>(null);
  const [editing, setEditing] = useState<CreatorProduct | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deliveryType, setDeliveryType] = useState<CreatorProduct["deliveryType"]>("file");
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/creator/products");
      const data = (await res.json()) as ProductsResponse;
      if (!res.ok) throw new Error(data.error ?? "Could not load your products.");
      setProducts(data.products ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load your products.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setDeliveryType("file");
    setDeliveryUrl("");
    setFileName("");
    setFileUrl("");
    setFormError(null);
  }

  function startEdit(item: CreatorProduct) {
    setEditing(item);
    setTitle(item.title);
    setDescription(item.description ?? "");
    setPrice(String(item.price));
    setDeliveryType(item.deliveryType);
    setDeliveryUrl(item.deliveryUrl ?? "");
    setFileName(item.assets[0]?.fileName ?? "");
    setFileUrl(item.assets[0]?.fileUrl ?? "");
    setFormError(null);
  }

  async function persistOrder(next: CreatorProduct[]) {
    setProducts(next);
    try {
      const res = await fetch("/api/creator/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((item) => item.id) }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save the new order.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the new order.");
      await load();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = products.findIndex((item) => item.id === active.id);
    const newIndex = products.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    void persistOrder(arrayMove(products, oldIndex, newIndex));
  }

  function handleMove(id: string, direction: -1 | 1) {
    const index = products.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= products.length) return;
    void persistOrder(arrayMove(products, index, target));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsedPrice = Number.parseInt(price || "0", 10);
    if (title.trim().length === 0) {
      setFormError("A product needs a title.");
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setFormError("Enter a price in whole rupiah, or 0 to give it away free.");
      return;
    }
    if (deliveryType === "file" && (fileName.trim().length === 0 || fileUrl.trim().length === 0)) {
      setFormError("File delivery needs at least one file: give it a name and a URL.");
      return;
    }
    if (deliveryType === "link" && deliveryUrl.trim().length === 0) {
      setFormError("Link delivery needs a destination URL.");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        title,
        description,
        price: parsedPrice,
        deliveryType,
        deliveryUrl: deliveryType === "link" ? deliveryUrl : null,
        assets:
          deliveryType === "file" && fileName.trim() && fileUrl.trim()
            ? [{ fileName, fileUrl }]
            : [],
      };

      const res = await fetch(
        editing ? `/api/creator/products/${editing.id}` : "/api/creator/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not save this product.");

      toast.success(editing ? "Product updated." : "Product published.");
      resetForm();
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this product.");
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      const res = await fetch(`/api/creator/products/${target.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Could not delete this product.");
      }
      toast.success("Product removed.");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete this product.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Digital Products"
        description="Sell files, links, or licence keys. Payment is collected by Midtrans and delivery is automatic."
        tag="openlynk"
        category="Storefront editor"
      >
        <Badge variant="outline" className="font-mono">
          {products.length} products
        </Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Frame spacing="default" className="card-vercel border border-border/80 shadow-xs">
          <FramePanel className="flex flex-col gap-4">
            <FrameHeader className="flex flex-row items-center justify-between p-0">
              <div>
                <FrameTitle className="text-base font-bold">Your catalogue</FrameTitle>
                <FrameDescription className="text-xs">
                  Order here is the order shown on your page.
                </FrameDescription>
              </div>
            </FrameHeader>

            {isLoading ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full rounded-lg" />
                ))}
              </div>
            ) : loadError ? (
              <Alert variant="destructive">
                <AlertTitle>Could not load your products</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{loadError}</span>
                  <Button variant="outline" size="sm" onClick={() => void load()} className="w-fit">
                    Retry
                  </Button>
                </AlertDescription>
              </Alert>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/80 p-8 text-center">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Package className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium">No products yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add your first product to start selling.
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
                  items={products.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {products.map((item, index) => (
                      <SortableProductRow
                        key={item.id}
                        item={item}
                        onEdit={startEdit}
                        onDelete={setPendingDelete}
                        onMove={handleMove}
                        isFirst={index === 0}
                        isLast={index === products.length - 1}
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
                {editing ? "Edit product" : "New product"}
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
                <Label htmlFor="product-title" className="text-xs">
                  Title
                </Label>
                <Input
                  id="product-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Lightroom Preset Pack"
                  maxLength={120}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="product-description" className="text-xs">
                  Description
                </Label>
                {/* No Textarea component is installed; a plain textarea keeps the same
                    token-based styling without adding a dependency for one field. */}
                <textarea
                  id="product-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What the buyer gets, in a sentence or two."
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="product-price" className="text-xs">
                  Price in rupiah
                </Label>
                <Input
                  id="product-price"
                  value={price}
                  onChange={(event) => setPrice(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="49000"
                  inputMode="numeric"
                />
                <p className="text-[11px] text-muted-foreground">
                  Enter 0 to give this product away for free.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="product-delivery" className="text-xs">
                  How it is delivered
                </Label>
                <Select
                  value={deliveryType}
                  onValueChange={(value) =>
                    setDeliveryType(value as CreatorProduct["deliveryType"])
                  }
                >
                  <SelectTrigger id="product-delivery" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="file">Downloadable file</SelectItem>
                    <SelectItem value="link">Private link</SelectItem>
                    <SelectItem value="code">Licence key</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {deliveryType === "file" && (
                <>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="asset-name" className="text-xs">
                      File name
                    </Label>
                    <Input
                      id="asset-name"
                      value={fileName}
                      onChange={(event) => setFileName(event.target.value)}
                      placeholder="preset-pack.zip"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="asset-url" className="text-xs">
                      File URL
                    </Label>
                    <Input
                      id="asset-url"
                      value={fileUrl}
                      onChange={(event) => setFileUrl(event.target.value)}
                      placeholder="https://cdn.example.com/preset-pack.zip"
                      inputMode="url"
                    />
                  </div>
                </>
              )}

              {deliveryType === "link" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="delivery-url" className="text-xs">
                    Delivery URL
                  </Label>
                  <Input
                    id="delivery-url"
                    value={deliveryUrl}
                    onChange={(event) => setDeliveryUrl(event.target.value)}
                    placeholder="https://notion.so/your-private-page"
                    inputMode="url"
                  />
                </div>
              )}

              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Spinner className="size-4" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    {editing ? "Save changes" : "Publish product"}
                  </>
                )}
              </Button>
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
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{pendingDelete?.title}&rdquo; will be removed from your storefront. Past buyers
              keep access to what they bought.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDelete()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ExternalLink className="size-3.5" />
        Preview your storefront from the Overview page once your page is published.
      </p>
    </div>
  );
}
