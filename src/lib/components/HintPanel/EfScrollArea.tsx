import type { CSSProperties, ReactNode, Ref } from "react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { cx } from "../ui/utils";
import styles from "./HintPanel.module.less";

/** Scroll area wrapper that applies the shared HintPanel scrollbar styles. */
export function EfScrollArea(props: {
  className?: string;
  style?: CSSProperties;
  viewportRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}): JSX.Element {
  const { className, style, viewportRef, children } = props;
  return (
    <ScrollArea.Root className={cx(styles.scrollRoot, className)} style={style}>
      <ScrollArea.Viewport ref={viewportRef} className={styles.scrollViewport}>
        {children}
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar orientation="vertical" className={styles.scrollbar}>
        <ScrollArea.Thumb className={styles.scrollThumb} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}

