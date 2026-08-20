"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_PAGE_CONTEXT, type PageContext } from "@/lib/assistant";

type Store = {
  context: PageContext;
  declare: (context: PageContext | null) => void;
};

const AssistantStore = React.createContext<Store | null>(null);

/**
 * Holds what the student is currently looking at so the floating assistant can
 * open already knowing the situation. Screens declare their context with
 * `useDeclareAssistantContext`.
 */
export function AssistantProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [declared, setDeclared] = React.useState<PageContext | null>(null);

  const declare = React.useCallback(
    (context: PageContext | null) => setDeclared(context),
    [],
  );

  const context = React.useMemo<PageContext>(
    () => ({
      ...(declared ?? DEFAULT_PAGE_CONTEXT),
      path: declared?.path ?? pathname,
    }),
    [declared, pathname],
  );

  const value = React.useMemo(() => ({ context, declare }), [context, declare]);

  return (
    <AssistantStore.Provider value={value}>{children}</AssistantStore.Provider>
  );
}

export function useAssistant(): Store {
  return (
    React.useContext(AssistantStore) ?? {
      context: DEFAULT_PAGE_CONTEXT,
      declare: () => {},
    }
  );
}

/** Renderless form of the hook, for declaring context from a server component. */
export function DeclareAssistantContext(context: PageContext) {
  useDeclareAssistantContext(context);
  return null;
}

/**
 * Declare the current screen for the assistant. Clears on unmount so a stale
 * question never follows the student to the next page.
 */
export function useDeclareAssistantContext(context: PageContext) {
  const { declare } = useAssistant();
  const serialised = JSON.stringify(context);

  React.useEffect(() => {
    declare(JSON.parse(serialised) as PageContext);
    return () => declare(null);
  }, [serialised, declare]);
}
