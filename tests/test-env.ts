// Test environment bootstrap
Object.assign(process.env, { NODE_ENV: "test" });
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/saas_starterkit_test";
process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test-better-auth-secret-minimum-32-chars-long!";
process.env.BETTER_AUTH_URL = process.env.BETTER_AUTH_URL || "http://localhost:3000";
process.env.MIDTRANS_SERVER_KEY = process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-test-key-12345";
process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "SB-Mid-client-test-key-12345";
process.env.MIDTRANS_IS_PRODUCTION = process.env.MIDTRANS_IS_PRODUCTION || "false";
process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION || "false";
