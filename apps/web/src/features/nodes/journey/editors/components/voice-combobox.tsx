/**
 * VoiceCombobox Component
 *
 * A searchable combobox for selecting voice profiles.
 * Uses the shadcn Combobox pattern (Popover + Command) for better UX with long lists.
 * Supports grouped display: "My Voices" (cloned/custom) and "Premade" voices.
 */

import { memo, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, User, UserRound } from "lucide-react";
import type { VoiceCategory } from "@journey/schemas/config";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/shared/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover";

interface Voice {
  readonly id: string;
  readonly label: string;
  readonly gender?: string;
  readonly category?: VoiceCategory;
}

/**
 * Check if a voice is a personal/custom voice (cloned, generated, or professional)
 */
function isPersonalVoice(category?: VoiceCategory): boolean {
  return category === "cloned" || category === "generated" || category === "professional";
}

interface VoiceComboboxProps {
  voices: readonly Voice[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isLoading?: boolean;
}

function GenderIcon({ gender }: { gender?: string }) {
  if (gender === "female") {
    return <UserRound className="size-3.5 text-pink-500" />;
  }
  if (gender === "male") {
    return <User className="size-3.5 text-blue-500" />;
  }
  return <User className="size-3.5 text-muted-foreground" />;
}

export const VoiceCombobox = memo(function VoiceCombobox({
  voices,
  value,
  onChange,
  disabled = false,
  placeholder = "Select voice...",
  isLoading = false,
}: VoiceComboboxProps) {
  const [open, setOpen] = useState(false);

  const selectedVoice = voices.find((voice) => voice.id === value);

  // Group voices by category: personal (cloned/generated/professional) vs premade
  const { personalVoices, premadeVoices } = useMemo(() => {
    const personal: Voice[] = [];
    const premade: Voice[] = [];

    for (const voice of voices) {
      if (isPersonalVoice(voice.category)) {
        personal.push(voice);
      } else {
        premade.push(voice);
      }
    }

    return { personalVoices: personal, premadeVoices: premade };
  }, [voices]);

  const renderVoiceItem = (voice: Voice) => (
    <CommandItem
      key={voice.id}
      value={`${voice.label} ${voice.gender || ""}`}
      onSelect={() => {
        onChange(voice.id);
        setOpen(false);
      }}
      className="flex items-center gap-2"
    >
      <Check
        className={cn("size-4 shrink-0", value === voice.id ? "opacity-100" : "opacity-0")}
      />
      <GenderIcon gender={voice.gender} />
      <span className="truncate">{voice.label}</span>
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-9 w-full justify-between font-normal"
          disabled={disabled || isLoading}
        >
          {isLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading voices...
            </span>
          ) : selectedVoice ? (
            <span className="flex items-center gap-2 truncate">
              <GenderIcon gender={selectedVoice.gender} />
              {selectedVoice.label}
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search voices..." />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>No voice found.</CommandEmpty>
            {/* Personal/Custom Voices Group */}
            {personalVoices.length > 0 && (
              <CommandGroup heading="My Voices">
                {personalVoices.map(renderVoiceItem)}
              </CommandGroup>
            )}
            {/* Premade Voices Group */}
            {premadeVoices.length > 0 && (
              <CommandGroup heading={personalVoices.length > 0 ? "Premade" : undefined}>
                {premadeVoices.map(renderVoiceItem)}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
});
