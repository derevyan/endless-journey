import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useId } from "react";

import { Switch } from "@/shared/components/ui/switch";

export function ThemeSwitch() {
  const id = useId();
  const { setTheme, resolvedTheme } = useTheme();

  // Map theme to switch state: light = checked (sun), dark = unchecked (moon)
  // Use resolvedTheme to handle system theme (resolves to actual light/dark)
  const isLight = resolvedTheme === "light";

  const handleCheckedChange = (checked: boolean) => {
    setTheme(checked ? "light" : "dark");
  };

  return (
    <div className="inline-flex items-center gap-2">
      <MoonIcon className="size-4 text-muted-foreground" />
      <Switch checked={isLight} className="h-5 w-9" id={id} onCheckedChange={handleCheckedChange} />
      <SunIcon className="size-4" />
    </div>
  );
}
