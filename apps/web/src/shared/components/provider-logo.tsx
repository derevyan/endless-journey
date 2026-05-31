import { cn } from "@/shared/lib/utils";
import { Layers } from "lucide-react";
import { useState } from "react";

/**
 * Provider configuration with display labels and logos
 */
export const PROVIDER_CONFIG: Record<string, { name: string; logo: string; color: string }> = {
  openai: { name: "OpenAI", logo: "/logos/providers/openai.svg", color: "text-green-500" },
  anthropic: { name: "Anthropic", logo: "/logos/providers/anthropic.svg", color: "text-orange-500" },
  "google-genai": { name: "Google", logo: "/logos/providers/google.svg", color: "text-blue-500" },
  groq: { name: "Groq", logo: "/logos/providers/groq.svg", color: "text-red-500" },
};

export interface ProviderLogoProps {
  provider: string;
  className?: string;
  showName?: boolean;
}

/**
 * Provider Logo Component with fallback
 */
export function ProviderLogo({ provider, className }: ProviderLogoProps) {
  const config = PROVIDER_CONFIG[provider];
  const [error, setError] = useState(false);

  if (!config || error) {
    // Fallback icon based on first letter or generic
    return <Layers className={cn("text-muted-foreground", className)} />;
  }

  return (
    <img
      src={config.logo}
      alt={config.name}
      className={cn("object-contain", className)}
      onError={() => setError(true)}
      style={{ filter: "var(--logo-filter, none)" }}
    />
  );
}
