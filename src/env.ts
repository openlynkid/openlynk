import { z } from "zod";

export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Optional in the schema only because Netlify injects NETLIFY_DB_URL at runtime and may
  // not expose it during the build; `validateEnv` still requires it everywhere else.
  DATABASE_URL: z.string().url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url().default("http://localhost:3000"),
  MIDTRANS_SERVER_KEY: z.string().min(1, "MIDTRANS_SERVER_KEY is required"),
  MIDTRANS_IS_PRODUCTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
  // Optional so a starter that never schedules the expiry sweep still boots (the route
  // fails closed at runtime, D-5). When present it must be long enough to resist guessing,
  // so a weak secret is caught at build time rather than shipped.
  CRON_SECRET: z
    .string()
    .min(32, "CRON_SECRET must be at least 32 characters")
    .optional(),
});

export const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: z.string().min(1, "NEXT_PUBLIC_MIDTRANS_CLIENT_KEY is required"),
  NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: z
    .enum(["true", "false"])
    .default("false")
    .transform((val) => val === "true"),
});

export const formatErrors = (errors: z.ZodFormattedError<Map<string, string>, string>) =>
  Object.entries(errors)
    .map(([name, value]) => {
      if (value && "_errors" in value && value._errors.length) {
        return `${name}: ${value._errors.join(", ")}`;
      }
      return null;
    })
    .filter(Boolean)
    .join("\n");

const isServer = typeof window === "undefined";

export function validateEnv(customEnv?: {
  server?: Record<string, unknown>;
  client?: Record<string, unknown>;
}) {
  const rawClient = customEnv?.client ?? {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL,
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION,
  };

  const clientResult = clientSchema.safeParse(rawClient);

  if (!clientResult.success) {
    const errorMsg = formatErrors(clientResult.error.format());
    console.error("❌ Invalid client environment variables:\n", errorMsg);
    throw new Error(`Invalid client environment variables:\n${errorMsg}`);
  }

  let serverEnv = {} as z.infer<typeof serverSchema>;
  if (isServer) {
    const rawServer = customEnv?.server ?? {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL || process.env.NETLIFY_DB_URL || undefined,
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
      MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY,
      MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
      // Empty is treated as absent: a blank value means "not scheduled", which the route
      // already fails closed on, so it must not block a build.
      CRON_SECRET: process.env.CRON_SECRET || undefined,
    };

    // Verify client and server gateway flags do not silently conflict
    const serverFlag = rawServer.MIDTRANS_IS_PRODUCTION as string | undefined;
    const clientFlag = rawClient.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION as string | undefined;

    const isServerProd = serverFlag === "true";
    const isClientProd = clientFlag === "true";

    if (isServerProd !== isClientProd) {
      throw new Error(
        `Gateway environment conflict: MIDTRANS_IS_PRODUCTION (${serverFlag ?? "omitted"}) and NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION (${clientFlag ?? "omitted"}) must agree.`
      );
    }

    // A Netlify build provisions the database itself, so a missing URL there is expected.
    if (!rawServer.DATABASE_URL && process.env.NETLIFY !== "true") {
      console.error("❌ Invalid server environment variables:\n", "DATABASE_URL: DATABASE_URL is required");
      throw new Error("Invalid server environment variables:\nDATABASE_URL: DATABASE_URL is required");
    }

    const serverResult = serverSchema.safeParse(rawServer);

    if (!serverResult.success) {
      const errorMsg = formatErrors(serverResult.error.format());
      console.error("❌ Invalid server environment variables:\n", errorMsg);
      throw new Error(`Invalid server environment variables:\n${errorMsg}`);
    }

    serverEnv = serverResult.data;
  }

  return {
    ...serverEnv,
    ...clientResult.data,
  };
}

/**
 * `next build` evaluates this module while collecting page data. A deploy whose secrets
 * are not configured yet must still build, so during that phase only, missing keys get
 * build-only placeholders and a warning. Every runtime evaluation (a fresh process without
 * `NEXT_PHASE`) still validates strictly and fails closed, and CI enforces the full
 * contract separately with `pnpm check:deploy-env`.
 */
function validateEnvForBuild() {
  try {
    return validateEnv();
  } catch (error) {
    console.warn(
      "⚠️ Building with placeholder environment values; the app will refuse to start until they are set.\n",
      error instanceof Error ? error.message : error
    );
    const placeholder = "build-time-placeholder-not-a-real-value-000";
    return validateEnv({
      client: {
        NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL,
        NEXT_PUBLIC_MIDTRANS_CLIENT_KEY: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || placeholder,
        NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION: process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION,
      },
      server: {
        NODE_ENV: process.env.NODE_ENV,
        DATABASE_URL:
          process.env.DATABASE_URL ||
          process.env.NETLIFY_DB_URL ||
          "postgresql://placeholder:placeholder@localhost:5432/placeholder",
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || placeholder,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        MIDTRANS_SERVER_KEY: process.env.MIDTRANS_SERVER_KEY || placeholder,
        MIDTRANS_IS_PRODUCTION: process.env.MIDTRANS_IS_PRODUCTION,
        CRON_SECRET: process.env.CRON_SECRET || undefined,
      },
    });
  }
}

export const env =
  process.env.NEXT_PHASE === "phase-production-build" ? validateEnvForBuild() : validateEnv();
