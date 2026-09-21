"use client";

import { useMemo, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox";

import { Input } from "@/components/ui/input";
import { listItemClass, listItemIndicatorClass, listPopupClass, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** A SelectOption whose label is text, because typing has to match against it. */
export type ComboboxOption<T extends string = string> = SelectOption<T> & { label: string };

const sameOption = (a: ComboboxOption, b: ComboboxOption) => a.value === b.value;

/**
 * A select you can type into: the app's one picker, from a language to one of
 * fifteen participants at the auction desk. The same shape as SimpleSelect (a
 * value, a change handler, a list).
 *
 * Typing filters the list by label; Enter takes the highlighted match, so
 * "bal" + Enter picks Bala1 without a mouse, and "py" + Enter picks Python.
 * Opening the box shows the whole list, so it still works as a plain dropdown
 * for someone who would rather click. By default something is always chosen:
 * clearing the text and leaving puts the chosen entry back. `clearable` lets
 * an empty box mean "nothing chosen", for a field that starts blank.
 */
type Props<T extends string> = {
  options: readonly ComboboxOption<T>[];
  placeholder?: string;
  empty?: string;
  className?: string;
  /** For the box itself, e.g. a dark editor toolbar. */
  inputClassName?: string;
  size?: "sm" | "default";
  disabled?: boolean;
  "aria-label"?: string;
} & (
  // Something is always chosen, so the handler never sees an empty value.
  | { clearable?: false; value: T; onValueChange: (v: T) => void }
  // An empty box is a state of its own: "nobody yet".
  | { clearable: true; value: T | ""; onValueChange: (v: T | "") => void }
);

function SimpleCombobox<T extends string>({
  options,
  placeholder,
  empty = "No match.",
  className,
  inputClassName,
  size = "default",
  disabled,
  "aria-label": ariaLabel,
  ...choice
}: Props<T>) {
  const { value } = choice;
  // Base UI reads `label` and `value` off `{ value, label }` items on its own.
  // Base UI compares the selected value by identity, so it is memoised: a new
  // object each render would make it re-sync the input text on every render.
  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);
  // The text while typing; null shows the chosen entry. Leaving the box with
  // it empty or half-typed brings the choice back rather than losing it.
  const [text, setText] = useState<string | null>(null);
  return (
    <ComboboxPrimitive.Root<ComboboxOption<T>>
      items={options}
      value={selected}
      onValueChange={(next) => {
        if (next) choice.onValueChange(next.value);
        else if (choice.clearable) choice.onValueChange("");
      }}
      inputValue={text ?? selected?.label ?? ""}
      onInputValueChange={setText}
      onOpenChange={(open) => { if (!open) setText(null); }}
      isItemEqualToValue={sameOption}
      autoHighlight
      disabled={disabled}
    >
      <div className={cn("relative", className)}>
        <ComboboxPrimitive.Input
          render={<Input className={cn("pr-9", size === "sm" && "h-8 text-[13px]", inputClassName)} />}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onBlur={() => setText(null)}
        />
        <ComboboxPrimitive.Trigger
          aria-label="Open the list"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground disabled:pointer-events-none"
        >
          <ChevronDownIcon className="size-4 opacity-50" />
        </ComboboxPrimitive.Trigger>
      </div>
      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner align="start" sideOffset={4} className="z-50">
          <ComboboxPrimitive.Popup data-slot="combobox-content" className={listPopupClass}>
            <ComboboxPrimitive.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:m-0 empty:p-0">
              {empty}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List className="p-1">
              {(o: ComboboxOption<T>) => (
                <ComboboxPrimitive.Item
                  key={o.value}
                  value={o}
                  className={cn(listItemClass, "data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground")}
                >
                  <span className={listItemIndicatorClass}>
                    <ComboboxPrimitive.ItemIndicator>
                      <CheckIcon className="size-4" />
                    </ComboboxPrimitive.ItemIndicator>
                  </span>
                  <span className="truncate">{o.label}</span>
                  {o.hint && <span className="shrink-0 text-faint">{o.hint}</span>}
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export { SimpleCombobox };
