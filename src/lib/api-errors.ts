import { NextResponse } from "next/server";
import { unstable_rethrow } from "next/navigation";
import {
  CreatorLimitError,
  CreatorNotFoundError,
  CreatorValidationError,
} from "@/modules/creator/service";
import {
  StoreNotFoundError,
  StoreValidationError,
  StoreWebhookError,
} from "@/modules/store/types";

/**
 * Maps a domain error to the HTTP status a client should see.
 *
 * Keeping the mapping in one place means a new domain error cannot accidentally become
 * a 500 — which is how a validation mistake turns into a retry storm. Returns `null` for
 * an unrecognised error so the caller can log it and answer 500 without leaking the
 * internal message.
 */
export function statusForError(error: unknown): number | null {
  if (error instanceof CreatorValidationError || error instanceof StoreValidationError) {
    return 400;
  }
  if (error instanceof StoreWebhookError) {
    return 400;
  }
  if (error instanceof CreatorNotFoundError || error instanceof StoreNotFoundError) {
    return 404;
  }
  // A plan limit is a "payment required"-style refusal, not a malformed request.
  if (error instanceof CreatorLimitError) {
    return 402;
  }
  return null;
}

/**
 * Builds a JSON error response for a thrown domain error.
 *
 * Only the curated `message` is exposed. Anything unrecognised is logged server-side and
 * answered with a generic string, so a database or gateway message never reaches the
 * client — the existing webhook route holds the same line.
 */
export function errorResponse(error: unknown, context: string): NextResponse {
  // Next signals "this route used request data, so it cannot be prerendered" by throwing
  // an internal error. Swallowing it here would turn a build-time diagnostic into a
  // logged 500, so it is rethrown before any application handling.
  unstable_rethrow(error);

  const status = statusForError(error);
  if (status !== null && error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status });
  }

  console.error(
    `❌ ${context}:`,
    error instanceof Error ? error.message : error,
  );
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}
