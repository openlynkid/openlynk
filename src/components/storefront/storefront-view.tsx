import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/reui/badge";
import { ViewTracker } from "@/components/storefront/view-tracker";
import { TrackedLink } from "@/components/storefront/tracked-link";
import { getCachedProfile } from "@/components/storefront/queries";
import { BENTO_GRID_CLASS, tileSpanClass } from "@/components/storefront/bento";
import {
  accentStyleForTheme,
  buttonClassForTheme,
  fontClassForTheme,
  formatIDR,
  hairlineStyleForTheme,
} from "@/components/storefront/theme";
import { ArrowRight, ExternalLink, FileDown, Link2 } from "lucide-react";
import type { PublicLink } from "@/modules/creator/types";

/** A text tile: a paragraph in the flow, styled by the theme rather than a card. */
function TextTile({ link }: { link: PublicLink }) {
  return (
    <div className="flex flex-col justify-center gap-1 p-1">
      {link.title && <p className="text-sm font-semibold tracking-tight">{link.title}</p>}
      {link.description && (
        <p className="text-xs leading-relaxed opacity-75">{link.description}</p>
      )}
    </div>
  );
}

/** An image tile: a cover that fills its footprint, optionally clickable. */
function ImageTile({
  link,
  username,
}: {
  link: PublicLink;
  username: string;
}) {
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={link.url ?? ""}
      alt={link.title || ""}
      className="size-full object-cover"
    />
  );

  return (
    <div className="relative size-full overflow-hidden rounded-lg">
      {link.url ? (
        <TrackedLink
          username={username}
          linkId={link.id}
          href={link.url}
          className="block size-full transition-opacity hover:opacity-90"
        >
          {image}
        </TrackedLink>
      ) : (
        image
      )}
      {link.title && (
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white">
          {link.title}
        </span>
      )}
    </div>
  );
}


/**
 * The profile body, split out of the page so the page itself can stay synchronous.
 *
 * Cache Components cannot prerender a route whose page awaits `params` — awaiting it is
 * runtime data. Keeping the page a plain function and awaiting inside a `<Suspense>`
 * boundary leaves a static shell for the theme, the header and the empty state.
 */
export async function StorefrontView({ username }: { username: string }) {
  const profile = await getCachedProfile(username.trim().toLowerCase());

  if (!profile) notFound();

  const { theme } = profile;
  const buttonClass = buttonClassForTheme(theme);
  const accentStyle = accentStyleForTheme(theme);
  const hairline = hairlineStyleForTheme(theme);
  const isEmpty = profile.links.length === 0 && profile.products.length === 0;

  return (
    <div
      className={`min-h-screen flex flex-col ${fontClassForTheme(theme.fontFamily)}`}
      style={{ backgroundColor: theme.background, color: theme.textColor }}
    >
      <ViewTracker username={profile.username} />

      <main className="flex-1 w-full max-w-xl mx-auto px-5 py-12 flex flex-col gap-8">
        <header className="flex flex-col items-center text-center gap-3">
          {profile.avatarUrl ? (
            // A creator-supplied remote avatar. A plain <img> avoids having to
            // allow-list every possible image host in next.config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt={profile.displayName}
              className="size-20 rounded-full object-cover"
            />
          ) : (
            <div
              className="size-20 rounded-full flex items-center justify-center text-2xl font-bold"
              style={accentStyle}
            >
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight">{profile.displayName}</h1>
            <p className="text-xs opacity-70">@{profile.username}</p>
          </div>
          {profile.bio && (
            <p className="text-sm opacity-80 leading-relaxed max-w-sm">{profile.bio}</p>
          )}
        </header>

        {profile.links.length > 0 && (
          <nav className={BENTO_GRID_CLASS}>
            {profile.links.map((link) => {
              // Headers and dividers are page furniture rather than tiles: they always
              // take the full width so they read as a break in the flow, whatever
              // footprint happens to be stored on them.
              if (link.type === "divider") {
                return (
                  <hr
                    key={link.id}
                    className="col-span-4 my-1 border-t opacity-20"
                  />
                );
              }

              if (link.type === "header") {
                return (
                  <h2
                    key={link.id}
                    className="col-span-4 pt-2 text-xs font-semibold uppercase tracking-widest opacity-60"
                  >
                    {link.title}
                  </h2>
                );
              }

              if (link.type === "text") {
                return (
                  <div key={link.id} className={tileSpanClass(link.layout)}>
                    <TextTile link={link} />
                  </div>
                );
              }

              if (link.type === "image") {
                return (
                  <div key={link.id} className={tileSpanClass(link.layout)}>
                    <ImageTile link={link} username={profile.username} />
                  </div>
                );
              }

              return (
                <div key={link.id} className={`${tileSpanClass(link.layout)} min-w-0`}>
                  <TrackedLink
                    username={profile.username}
                    linkId={link.id}
                    href={link.url ?? "#"}
                    className={`${buttonClass} h-full justify-between shadow-xs hover:opacity-90`}
                    style={accentStyle}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      {link.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={link.thumbnailUrl}
                          alt=""
                          className="size-6 rounded object-cover shrink-0"
                        />
                      ) : (
                        <Link2 className="size-4 shrink-0" />
                      )}
                      <span className="truncate">{link.title}</span>
                    </span>
                    <ExternalLink className="size-3.5 shrink-0 opacity-70" />
                  </TrackedLink>
                </div>
              );
            })}
          </nav>
        )}

        {profile.products.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="pt-2 text-xs font-semibold uppercase tracking-widest opacity-60">
              Products
            </h2>
            {profile.products.map((item) => (
              <Link
                key={item.id}
                href={`/u/${profile.username}/${item.slug}`}
                className="flex items-center gap-3 rounded-xl border p-3 transition-colors hover:opacity-90"
                style={hairline}
              >
                {item.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.coverImageUrl}
                    alt=""
                    className="size-14 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="size-14 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${theme.accentColor}22` }}
                  >
                    <FileDown className="size-5" style={{ color: theme.accentColor }} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{item.title}</p>
                  {item.description && (
                    <p className="text-xs opacity-70 line-clamp-1">{item.description}</p>
                  )}
                  <p className="text-xs font-bold pt-0.5">
                    {item.price === 0 ? "Free" : formatIDR(item.price)}
                  </p>
                </div>
                <ArrowRight className="size-4 shrink-0 opacity-60" />
              </Link>
            ))}
          </section>
        )}

        {isEmpty && (
          <div
            className="rounded-xl border border-dashed p-8 text-center flex flex-col gap-2 opacity-70"
            style={hairline}
          >
            <p className="text-sm font-medium">This page is empty for now.</p>
            <p className="text-xs">Links and products will appear here once they are added.</p>
          </div>
        )}

        <footer className="pt-6 flex flex-col items-center gap-2 text-[11px] opacity-60">
          {profile.showBranding && (
            <Link href="/" className="hover:opacity-100 transition-opacity">
              Made with OpenLynk
            </Link>
          )}
          <Badge variant="outline" className="border-current opacity-70">
            {profile.links.length} links · {profile.products.length} products
          </Badge>
        </footer>
      </main>
    </div>
  );
}
