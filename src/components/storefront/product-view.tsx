import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { getCachedProduct } from "@/components/storefront/queries";
import { ProductViewTracker } from "@/components/storefront/view-tracker";
import { ProductCheckout } from "@/components/storefront/product-checkout";
import {
  accentStyleForTheme,
  fontClassForTheme,
  formatIDR,
  hairlineStyleForTheme,
} from "@/components/storefront/theme";
import { resolveTheme } from "@/modules/creator/types";
import { ArrowLeft, FileDown, ShieldCheck } from "lucide-react";

/**
 * The product body, split out of the page for the same reason as the bio page: awaiting
 * `params` in a page is runtime data, so it has to happen behind a `<Suspense>` boundary
 * for the route to keep a static shell.
 */
export async function ProductView({ username, slug }: { username: string; slug: string }) {
  const result = await getCachedProduct(username.trim().toLowerCase(), slug);

  if (!result) notFound();

  const { profile, product, assets, showBranding } = result;
  // The row stores a partial theme; the renderer needs every field resolved.
  const theme = resolveTheme(profile.theme);
  const hairline = hairlineStyleForTheme(theme);
  const discount =
    product.compareAtPrice && product.compareAtPrice > product.price
      ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
      : 0;

  return (
    <div
      className={`min-h-screen flex flex-col ${fontClassForTheme(theme.fontFamily)}`}
      style={{ backgroundColor: theme.background, color: theme.textColor }}
    >
      <ProductViewTracker username={profile.username} productId={product.id} />
      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-10 flex flex-col gap-6">
        <Link
          href={`/u/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs opacity-70 hover:opacity-100 transition-opacity w-fit"
        >
          <ArrowLeft className="size-3.5" />
          Back to {profile.displayName}
        </Link>

        {product.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.coverImageUrl}
            alt=""
            className="w-full aspect-video rounded-xl object-cover"
          />
        ) : (
          <div
            className="w-full aspect-video rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.accentColor}18` }}
          >
            <FileDown className="size-10" style={{ color: theme.accentColor }} />
          </div>
        )}

        <header className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-current opacity-70 capitalize">
              {product.productType}
            </Badge>
            {discount > 0 && (
              <Badge variant="success-light" className="font-mono">
                {discount}% off
              </Badge>
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight">{product.title}</h1>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold tabular-nums">
              {product.price === 0 ? "Free" : formatIDR(product.price)}
            </span>
            {discount > 0 && product.compareAtPrice && (
              <span className="text-sm opacity-60 line-through">
                {formatIDR(product.compareAtPrice)}
              </span>
            )}
          </div>

          {product.description && (
            <p className="text-sm opacity-80 leading-relaxed whitespace-pre-line">
              {product.description}
            </p>
          )}
        </header>

        <ProductCheckout
          username={profile.username}
          productId={product.id}
          price={product.price}
          isFree={product.price === 0}
          accentColor={theme.accentColor}
          pageBackground={theme.background}
        />

        {assets.length > 0 && (
          <section className="rounded-xl border p-4 flex flex-col gap-2" style={hairline}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60">
              What you get
            </p>
            {assets.map((asset) => (
              <div key={asset.id} className="flex items-center gap-2 text-xs opacity-80">
                <FileDown className="size-3.5 shrink-0" />
                <span className="truncate">{asset.fileName}</span>
              </div>
            ))}
          </section>
        )}

        <div className="flex items-center gap-1.5 text-[11px] opacity-60">
          <ShieldCheck className="size-3.5" />
          Payments are processed securely by Midtrans. Files are delivered instantly.
        </div>

        <footer className="pt-4 flex flex-col items-center gap-2 text-[11px] opacity-60">
          <span style={accentStyleForTheme(theme)} className="rounded-full px-2 py-0.5">
            {product.salesCount} sold
          </span>
          {showBranding && (
            <Link href="/" className="hover:opacity-100 transition-opacity">
              Made with OpenLynk
            </Link>
          )}
        </footer>
      </main>
    </div>
  );
}
