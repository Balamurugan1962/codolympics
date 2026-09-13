"use client";

/** A dropdown for secondary and destructive row actions, on Radix so focus and keys behave. */
import { Icon } from "../icons";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";

export type MenuItem =
  | { separator: true }
  | { heading: string }
  | { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean; icon?: React.ReactNode };

export function Menu({
  items,
  label = "More actions",
  align = "end",
  trigger,
}: {
  items: MenuItem[];
  label?: string;
  align?: "start" | "end";
  trigger?: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" aria-label={label}>
            <Icon.More />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-48">
        {items.map((it, i) =>
          "separator" in it ? (
            <DropdownMenuSeparator key={i} />
          ) : "heading" in it ? (
            <DropdownMenuLabel key={i}>{it.heading}</DropdownMenuLabel>
          ) : (
            <DropdownMenuItem key={it.label} disabled={it.disabled} variant={it.danger ? "destructive" : "default"} onSelect={it.onSelect}>
              {it.icon}
              {it.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
