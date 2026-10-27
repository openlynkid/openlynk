import { z } from "zod";

export const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().min(1, "DATABASE_URL is required"),
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
      DATABASE_URL: process.env.DATABASE_URL,
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

export const env = validateEnv();
