"use client";

/**
 * `asChild`: render as the child element instead of the default tag.
 *
 * Radix shipped this as `Slot`; Base UI takes the opposite approach and gives
 * every component a `render` prop. Both solve the same problem — a Button that
 * is really a Link, a Badge that is really an anchor — and this is the small
 * piece of glue that keeps our own components on the `asChild` spelling, so
 * the forty call sites that say `<Button asChild><Link/></Button>` did not all
 * have to change to make the swap.
 *
 * It merges the wrapper's props onto the child: class names concatenate,
 * handlers chain (wrapper first, then the child's own), and everything else is
 * overridden by the child, which is the same precedence Radix used. React 19
 * passes `ref` as an ordinary prop, so cloning carries it without a forwardRef
 * dance.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

type AnyProps = Record<string, unknown>;

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps, ...childProps };

  for (const key of Object.keys(slotProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];

    // Event handlers: both run, the wrapper's first.
    if (/^on[A-Z]/.test(key) && typeof slotValue === "function") {
      merged[key] =
        typeof childValue === "function"
          ? (...args: unknown[]) => {
              (slotValue as (...a: unknown[]) => void)(...args);
              (childValue as (...a: unknown[]) => void)(...args);
            }
          : slotValue;
    } else if (key === "className") {
      merged[key] = cn(slotValue as string, childValue as string);
    } else if (key === "style") {
      merged[key] = { ...(slotValue as object), ...(childValue as object) };
    }
  }

  return merged;
}

/**
 * Renders its only child with the given props merged in. If the child is not a
 * single element there is nothing to render as, so it renders nothing rather
 * than guessing — the same failure Radix produced, just quieter.
 */
function Slot({ children, ...props }: React.ComponentProps<"span">) {
  if (!React.isValidElement(children)) return null;
  const child = children as React.ReactElement<AnyProps>;
  return React.cloneElement(child, mergeProps(props as AnyProps, child.props));
}

export { Slot, mergeProps };

/**
 * Bridges our `asChild` API onto Base UI's `render` prop.
 *
 * Spread onto a Base UI part: `{...asChildRender(asChild, children)}`. When
 * `asChild` is set the child element becomes what the part renders as;
 * otherwise the child is just its content.
 */
function asChildRender(asChild: boolean | undefined, children: React.ReactNode) {
  return asChild && React.isValidElement(children)
    ? { render: children as React.ReactElement<Record<string, unknown>> }
    : { children };
}

export { asChildRender };
