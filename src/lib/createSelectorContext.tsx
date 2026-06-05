import { createContext, useContextSelector } from "use-context-selector";

/**
 * Creates a context + typed selector hook pair.
 *
 * @param name  Human-readable name used in the error thrown when the hook is
 *              called outside a matching provider.
 * @returns  `[Context, useSelector]` – the context object and a selector hook.
 */
export function createSelectorContext<T>(name: string, defaultValue?: T) {
  const Context = createContext<T | null>(defaultValue ?? null);

  function useSelector<R>(selector: (ctx: T) => R): R {
    return useContextSelector(Context, (value) => {
      if (!value) throw new Error(`useSelector must be used inside ${name}`);
      return selector(value);
    });
  }

  return [Context, useSelector] as const;
}
