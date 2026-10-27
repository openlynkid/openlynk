import { Badge } from "@/components/reui/badge";
import { cn } from "cn";

export interface ConnectionStatusProps {
  label?: string;
  status?: "connected" | "disconnected" | "connecting";
  className?: string;
}

export function ConnectionStatus({
  label = "PostgreSQL",
  status = "connected",
  className,
}: ConnectionStatusProps) {
  const statusColors = {
    connected: "bg-emerald-500",
    connecting: "bg-amber-500",
    disconnected: "bg-rose-500",
  }[status];

  return (
    <Badge
      variant="outline"
      size="sm"
      className={cn(
        "gap-1.5 py-1 px-2.5 font-mono text-[10px] text-muted-foreground border-dashed border-border/80 bg-background/50",
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full inline-block animate-pulse", statusColors)} />
      <span>Connected &bull; {label}</span>
    </Badge>
  );
}
