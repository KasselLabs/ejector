"use client";

import { useId, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A shadcn Input wrapped to reproduce the legacy MUI "outlined" text field:
 * a white 1px outline on black with the label floating on the top border
 * (the black label chip notches the border like MUI's fieldset/legend gap).
 */
export function OutlinedField({
  label,
  id,
  className,
  ...props
}: { label: string } & ComponentProps<"input">) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className={cn("relative w-full", className)}>
      <label
        htmlFor={fieldId}
        className="pointer-events-none absolute left-2 top-0 z-10 -translate-y-1/2 bg-black px-1 text-xs text-white/70"
      >
        {label}
      </label>
      <Input
        id={fieldId}
        className="h-auto rounded-[4px] border border-white bg-transparent px-3 py-3.5 text-base text-white placeholder:text-white/40 focus-visible:border-white focus-visible:ring-0"
        {...props}
      />
    </div>
  );
}
