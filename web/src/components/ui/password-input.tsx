"use client";

/**
 * A password field you can read back.
 *
 * People type their password on a borrowed keyboard, at a kiosk, with an
 * organiser reading it off a slip of paper. Eight dots tell them nothing about
 * why sign-in failed, and the usual answer is to type it again slower. The eye
 * is the fix: it holds the password visible while pressed, which is also how
 * an organiser reads out a password they have just set for somebody.
 *
 * The toggle is a real button with its own accessible name, 32px square, and
 * it never submits the form it sits in.
 */
import { useState } from "react";

import { Icon } from "../icons";
import { cn } from "@/lib/utils";

import { Input } from "./input";

export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={shown ? "text" : "password"} className={cn("pr-10", className)} />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
        title={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none"
      >
        {shown ? <Icon.EyeOff size={15} /> : <Icon.Eye size={15} />}
      </button>
    </div>
  );
}
