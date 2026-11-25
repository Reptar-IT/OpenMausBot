import { useState } from "react";
import { cn } from "@/lib/cn";

/** One connectable app as the Apps catalog lists it. */
export interface ToolkitCard {
  slug: string;
  label: string;
  blurb: string;
  logo: string | null;
  noAuth?: boolean;
  domain: string | null;
  categories?: string[];
}

export function localServiceLogo(logo: string | null): string | null {
  if (!logo) return null;
  if (logo.startsWith("data:image/")) return logo;
  return logo.startsWith("/") && !logo.startsWith("//") && !logo.includes("\\") && !/\s/.test(logo) ? logo : null;
}

export function ServiceIcon({ card, className = "size-11" }: { card: Pick<ToolkitCard, "logo" | "domain" | "label">; className?: string }) {
  const src = localServiceLogo(card.logo);
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src) {
    return <img src={src} alt="" loading="lazy" className={cn("rounded-xl object-contain", className)} onError={() => setFailed(src)} />;
  }
  return (
    <div className={cn("flex items-center justify-center rounded-xl bg-raised text-[15px] font-semibold text-ink-secondary", className)}>
      {card.label.slice(0, 1).toUpperCase()}
    </div>
  );
}
