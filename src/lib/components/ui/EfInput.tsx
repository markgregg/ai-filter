import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";
import { Input } from "@base-ui/react/input";

type EfInputProps = ComponentPropsWithoutRef<typeof Input>;

/**
 * An `Input` pre-configured with `data-slot="input"`.
 * All other Input props are forwarded as-is.
 */
export const EfInput = forwardRef<HTMLInputElement, EfInputProps>(
  function EfInput(props, ref) {
    return (
      <Input
        {...props}
        ref={ref}
        data-slot="input"
        autoComplete={props.autoComplete ?? "off"}
        autoCorrect={props.autoCorrect ?? "off"}
        autoCapitalize={props.autoCapitalize ?? "off"}
        spellCheck={props.spellCheck ?? false}
      />
    );
  },
);
