"use client";

import type { CSSProperties, ReactNode } from "react";
import { trackLinkClick } from "@/components/storefront/trackers";

/**
 * A creator link with click tracking attached.
 *
 * The anchor has to be a client component: an `onClick` cannot cross the server/client
 * boundary, and React refuses to render a server component that passes one. Keeping the
 * anchor here also means the storefront page itself stays server-rendered and cached.
 *
 * The navigation is never intercepted — `trackLinkClick` is fire-and-forget — so a
 * visitor still reaches the link even if the analytics request fails.
 */
export function TrackedLink({
  username,
  linkId,
  href,
  className,
  style,
  children,
}: {
  username: string;
  linkId: string;
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      onClick={() => trackLinkClick(username, linkId)}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
