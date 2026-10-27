import { Suspense } from "react";
import type { Metadata } from "next";
import { StorefrontView } from "@/components/storefront/storefront-view";
import { StorefrontShell } from "@/components/storefront/shell";
import { getCachedProfile } from "@/components/storefront/queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getCachedProfile(username.trim().toLowerCase());

  if (!profile) {
    return { title: "Page not found" };
  }

  return {
    title: profile.displayName,
    description: profile.bio ?? `Links and digital products from ${profile.displayName}.`,
    openGraph: {
      title: profile.displayName,
      description: profile.bio ?? undefined,
      images: profile.avatarUrl ? [profile.avatarUrl] : undefined,
    },
  };
}

/**
 * The page stays synchronous: awaiting `params` here would be runtime data at the page
 * level, which blocks prerendering under Cache Components. Reading it inside the
 * `<Suspense>` boundary keeps a static shell that paints immediately.
 */
export default function StorefrontPage({ params }: { params: Promise<{ username: string }> }) {
  return (
    <Suspense fallback={<StorefrontShell />}>
      {params.then(({ username }) => (
        <StorefrontView username={username} />
      ))}
    </Suspense>
  );
}
