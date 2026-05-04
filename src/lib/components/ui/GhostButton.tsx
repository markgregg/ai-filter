import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Button } from "@base-ui/react/button";

type GhostButtonProps = ComponentPropsWithoutRef<typeof Button>;

/**
 * A `Button` pre-configured with `data-slot="button"` and `data-variant="ghost"`.
 * All other Button props (including `data-size`) are forwarded as-is.
 */
export const GhostButton = forwardRef<HTMLButtonElement, GhostButtonProps>(
  function GhostButton(props, ref) {
    return <Button {...props} ref={ref} data-slot="button" data-variant="ghost" />;
  },
);
