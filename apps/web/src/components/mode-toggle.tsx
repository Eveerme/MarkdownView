import { PaletteIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@markdownview/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@markdownview/ui/components/dropdown-menu";

import { themeOptions } from "#src/lib/themes.ts";

export const ModeToggle = () => {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button aria-label="Toggle theme" size="icon" variant="ghost" />
        }
      >
        <PaletteIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup onValueChange={setTheme} value={theme}>
          {themeOptions.map(({ label, value }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
