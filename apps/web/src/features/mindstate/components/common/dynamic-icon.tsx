/**
 * Dynamic Icon Component
 *
 * Renders a lucide icon by name dynamically.
 */

import * as LucideIcons from "lucide-react";
import type { LucideProps } from "lucide-react";

interface DynamicIconProps extends LucideProps {
  name?: string;
}

/**
 * Map of commonly used icon names for agents
 */
const ICON_MAP: Record<string, keyof typeof LucideIcons> = {
  // Agent icons
  Bot: "Bot",
  Eye: "Eye",
  Heart: "Heart",
  Brain: "Brain",
  Zap: "Zap",
  Target: "Target",
  Users: "Users",
  Activity: "Activity",
  Cpu: "Cpu",
  BookOpen: "BookOpen",
  Fingerprint: "Fingerprint",
  Layers: "Layers",
  MapPin: "MapPin",
  Lightbulb: "Lightbulb",
  Sparkles: "Sparkles",
  Star: "Star",
  Shield: "Shield",
  Compass: "Compass",
  MessageCircle: "MessageCircle",
  User: "User",
};

export function DynamicIcon({ name = "Bot", className, size = 16, ...props }: DynamicIconProps) {
  // Try to get from our map first, then fallback to direct lookup
  const iconKey = ICON_MAP[name] || name;
  const IconComponent = LucideIcons[iconKey as keyof typeof LucideIcons] as React.ComponentType<LucideProps>;

  if (!IconComponent) {
    // Fallback to Bot if icon not found
    const FallbackIcon = LucideIcons.Bot;
    return <FallbackIcon className={className} size={size} {...props} />;
  }

  return <IconComponent className={className} size={size} {...props} />;
}

/**
 * Get all available icon names for the picker
 */
export function getAvailableIcons(): string[] {
  return Object.keys(ICON_MAP);
}
