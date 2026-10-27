import { Badge } from "@/components/reui/badge";
import { cn } from "cn";

export interface PageHeaderProps {
  title: string;
  description?: string;
  tag?: string;
  category?: string;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  tag = "openlynk",
  category = "App Router • Next.js 16",
  className,
  children,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative rounded-xl card-vercel p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs",
        className
      )}
    >
      <div className="space-y-1 max-w-2xl">
        <div className="flex items-center gap-2 mb-2">
          {tag && (
            <Badge
              variant="outline"
              className="border-border/80 text-foreground font-mono text-[10px] tracking-wide"
            >
              {tag}
            </Badge>
          )}
          {category && (
            <span className="text-xs font-mono text-muted-foreground">{category}</span>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {children && (
        <div className="flex items-center gap-2.5 shrink-0 self-stretch sm:self-auto justify-end">
          {children}
        </div>
      )}
    </div>
  );
}
