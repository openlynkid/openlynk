import Link from "next/link";
import { Badge } from "@/components/reui/badge";
import { cn } from "cn";

export interface BrandIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export function BrandIcon({ className, ...props }: BrandIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 398.088 390.191"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      <path d="M192.854 282.885 C192.854 235.776 157.523 200.445 110.414 200.445 C157.523 200.445 192.854 165.114 192.854 118.006 C192.854 165.114 228.185 200.445 275.293 200.445 C228.185 200.445 192.854 235.776 192.854 282.885 Z M88.595 317.283 L47.863 358.016 C36.123 369.756 44.31 389.836 60.913 389.969 C109.316 390.356 160.991 390.129 205.492 390.081 L214.163 390.049 C219.254 390.029 224.116 387.938 227.631 384.255 L232.538 379.113 L388.58 215.093 L392.946 210.506 C396.449 206.827 398.294 201.896 398.07 196.821 C396.805 168.196 395.793 139.354 394.938 110.774 C394.684 100.957 394.114 79.075 393.523 57.025 C393.082 40.6 373.202 32.677 361.583 44.295 L339.894 65.985 C336.356 69.523 334.382 74.33 334.413 79.333 L334.614 111.771 C334.724 131.549 334.688 151.375 334.55 171.122 C334.514 176.21 332.406 181.056 328.721 184.564 L197.568 309.415 C193.909 312.899 189.064 314.752 184.015 314.559 C158.477 313.584 129.745 312.655 102.375 311.809 C97.214 311.65 92.247 313.632 88.595 317.283 Z M170.319 9.488 C125.531 56.268 51.394 132.935 6.083 179.408 C2.048 183.546 -0.143 189.121 0.007 194.9 C0.739 223.089 1.699 251.443 2.15 279.593 C2.389 295.018 2.687 310.703 2.945 326.44 C3.255 345.334 26.124 354.578 39.486 341.216 L55.063 325.639 C59.162 321.54 61.413 315.95 61.308 310.155 C60.764 279.919 60.357 249.718 60.158 219.482 C60.119 213.618 62.46 208.014 66.672 203.933 C106.79 165.066 158.662 114.667 196.966 78.506 C201.442 74.281 207.535 72.256 213.662 72.844 C240.15 75.387 266.245 77.247 292.369 78.457 C298.397 78.737 304.268 76.434 308.535 72.167 L343.941 36.761 C357.323 23.379 348.043 0.413 329.118 0.189 C280.847 -0.383 232.194 0.3 184.676 2.861 C179.217 3.155 174.1 5.539 170.319 9.488 Z" />
    </svg>
  );
}

export interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  showBadge?: boolean;
  showText?: boolean;
  subtitle?: string;
  href?: string;
  className?: string;
  onClick?: () => void;
}

export function BrandLogo({
  size = "md",
  showBadge = true,
  showText = true,
  subtitle,
  href = "/",
  className,
  onClick,
}: BrandLogoProps) {
  const iconSizeClasses = {
    sm: "size-7 rounded-md",
    md: "size-8 rounded-lg",
    lg: "size-10 rounded-xl",
  }[size];

  const svgSize = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6",
  }[size];

  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];

  const content = (
    <div className={cn("flex items-center gap-2.5 group select-none", className)}>
      <div
        className={cn(
          "relative flex items-center justify-center bg-primary text-primary-foreground shadow-xs transition-transform group-hover:scale-105 shrink-0",
          iconSizeClasses
        )}
      >
        <BrandIcon className={svgSize} />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className={cn("flex items-center gap-1.5 font-bold tracking-tight", textSize)}>
            <span>open</span>
            <span className="text-muted-foreground font-normal">lynk</span>
            {showBadge && (
              <Badge
                variant="outline"
                size="xs"
                className="font-mono text-muted-foreground border-border/80"
              >
                v1.0
              </Badge>
            )}
          </div>
          {subtitle && (
            <span className="text-[11px] text-muted-foreground leading-tight">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} onClick={onClick} className="inline-flex">
        {content}
      </Link>
    );
  }

  return content;
}
