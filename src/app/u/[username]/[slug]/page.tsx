import { Suspense } from "react";
import type { Metadata } from "next";
import { ProductView } from "@/components/storefront/product-view";
import { ProductShell } from "@/components/storefront/shell";
import { getCachedProduct } from "@/components/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}): Promise<Metadata> {
  const { username, slug } = await params;
  const result = await getCachedProduct(username.trim().toLowerCase(), slug);

  if (!result) {
    return { title: "Product not found" };
  }

  return {
    title: `${result.product.title} — ${result.profile.displayName}`,
    description:
      result.product.description ?? `Buy ${result.product.title} from ${result.profile.displayName}.`,
    openGraph: {
      title: result.product.title,
      description: result.product.description ?? undefined,
      images: result.product.coverImageUrl ? [result.product.coverImageUrl] : undefined,
    },
  };
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  return (
    <Suspense fallback={<ProductShell />}>
      {params.then(({ username, slug }) => (
        <ProductView username={username} slug={slug} />
      ))}
    </Suspense>
  );
}
