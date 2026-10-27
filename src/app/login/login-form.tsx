"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/brand-logo";
import { toast } from "sonner";
import { Loader2, ArrowRight, ArrowLeft, Eye, EyeOff } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const { data: session, isPending: isSessionPending } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already authenticated, redirect away from login
  useEffect(() => {
    if (!isSessionPending && session?.user) {
      const redirectParam = typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("redirect")
        : null;
      router.replace(redirectParam || "/dashboard");
    }
  }, [session, isSessionPending, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please fill in both email and password.");
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        toast.error(result.error.message || "Failed to sign in. Check your credentials.");
      } else {
        toast.success("Signed in successfully!");
        const redirectParam = typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("redirect")
          : null;
        router.push(redirectParam || "/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // If already authenticated, show redirect state
  if (session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-grid-pattern vercel-spotlight font-sans">
        <div className="flex flex-col items-center gap-3 p-6 rounded-xl card-vercel border border-border/80 shadow-xs text-xs text-muted-foreground">
          <Loader2 className="size-6 animate-spin text-foreground" />
          <span>Already signed in. Redirecting to dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex flex-col justify-between bg-grid-pattern vercel-spotlight font-sans">
      {/* Top Bar with Home link & Theme Toggle */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between border-b border-border/70">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to home
        </Link>
        <ThemeToggle />
      </header>

      {/* Main Login Card in Vercel Blueprint Frame */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-6 relative">
          {/* Brand Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <BrandLogo href="/" size="md" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-xs text-muted-foreground font-mono">[01] Sign in to your account to continue</p>
          </div>

          <Card className="card-vercel rounded-xl border border-border/80 shadow-sm relative">
            <span className="grid-cross -top-[7px] -left-[7px]">+</span>
            <span className="grid-cross -top-[7px] -right-[7px]">+</span>
            <span className="grid-cross -bottom-[7px] -left-[7px]">+</span>
            <span className="grid-cross -bottom-[7px] -right-[7px]">+</span>

            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold">Sign In</CardTitle>
              <CardDescription className="text-xs">
                Enter your credentials to access your SaaS dashboard.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    className="border-border/80 focus-visible:ring-foreground/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                    <Link
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        toast.info("Password reset available in Enterprise tier.");
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      required
                      className="border-border/80 pr-10 focus-visible:ring-foreground/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="btn-vercel w-full text-xs font-semibold gap-2 mt-2 h-10 rounded-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="size-3.5" />
                    </>
                  )}
                </Button>
              </CardContent>
            </form>

            <CardFooter className="pt-2 border-t border-border/70 flex justify-center">
              <p className="text-xs text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link
                  href="/register"
                  className="text-foreground font-semibold underline underline-offset-4 hover:text-muted-foreground transition-colors"
                >
                  Create one now
                </Link>
              </p>
            </CardFooter>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-muted-foreground border-t border-border/70 font-mono">
        OpenLynk v1.0 &bull; Built with Better Auth &amp; Drizzle ORM
      </footer>
    </div>
  );
}
