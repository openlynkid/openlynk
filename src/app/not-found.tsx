import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/brand-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { FileQuestion, LayoutDashboard, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-foreground selection:text-background bg-grid-pattern vercel-spotlight">
      {/* Top Header */}
      <header className="w-full border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLogo href="/" size="md" />
          <ThemeToggle />
        </div>
      </header>

      {/* Center 404 Card */}
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-md card-vercel rounded-xl border border-border/80 shadow-lg text-center">
          <CardHeader className="space-y-3 pb-4">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-foreground/5 text-foreground border border-border/80">
              <FileQuestion className="size-7" />
            </div>
            <div className="inline-block mx-auto rounded-full border border-border/80 px-3 py-0.5 text-xs font-mono text-muted-foreground">
              [404] • Page Not Found
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              Page Not Found
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground leading-relaxed">
              The page you are looking for doesn&apos;t exist or has been moved to another URL.
            </CardDescription>
          </CardHeader>

          <CardContent className="text-xs text-muted-foreground">
            Please verify the address in your browser bar or use one of the navigation links below to continue.
          </CardContent>

          <CardFooter className="flex flex-col sm:flex-row items-center justify-center gap-2 border-t border-border/70 pt-4">
            <Link
              href="/"
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "w-full sm:w-auto text-xs gap-1.5 border-border/80",
              })}
            >
              <ArrowLeft className="size-3.5" />
              Return Home
            </Link>
            <Link
              href="/dashboard"
              className="btn-vercel w-full sm:w-auto inline-flex items-center justify-center text-xs font-semibold px-3.5 py-2 rounded-lg gap-1.5"
            >
              <LayoutDashboard className="size-3.5" />
              Go to Dashboard
            </Link>
          </CardFooter>
        </Card>
      </main>
    </div>
  );
}
