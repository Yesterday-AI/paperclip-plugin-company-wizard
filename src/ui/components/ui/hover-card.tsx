import {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import * as ReactDOM from 'react-dom';

// Context to pass open state + trigger rect from Root to Content
const HoverCardContext = createContext<{
  open: boolean;
  triggerRef: React.RefObject<HTMLElement | null>;
}>({ open: false, triggerRef: { current: null } });

function HoverCardRoot({
  children,
  openDelay = 200,
  closeDelay = 100,
}: {
  children: ReactNode;
  openDelay?: number;
  closeDelay?: number;
}) {
  const [open, setOpen] = useState(false);
  const openTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(() => setOpen(true), openDelay);
  }, [openDelay]);

  const handleLeave = useCallback(() => {
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), closeDelay);
  }, [closeDelay]);

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );

  return (
    <HoverCardContext.Provider value={{ open, triggerRef }}>
      <div
        ref={triggerRef}
        style={{ display: 'inline-block' }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {children}
      </div>
    </HoverCardContext.Provider>
  );
}

function HoverCardTrigger({ children }: { children: ReactNode; asChild?: boolean }) {
  return <>{children}</>;
}

function HoverCardContent({
  children,
  className,
  side = 'top',
  align = 'center',
  sideOffset = 6,
}: {
  children: ReactNode;
  className?: string;
  side?: string;
  align?: string;
  sideOffset?: number;
}) {
  const { open, triggerRef } = useContext(HoverCardContext);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const contentEl = contentRef.current;
    const contentWidth = contentEl?.offsetWidth || 320;

    let top: number;
    let left: number;

    if (side === 'top') {
      top = rect.top - sideOffset + window.scrollY;
      // Will be adjusted after render with transform
    } else {
      top = rect.bottom + sideOffset + window.scrollY;
    }

    if (align === 'center') {
      left = rect.left + rect.width / 2 - contentWidth / 2 + window.scrollX;
    } else if (align === 'end') {
      left = rect.right - contentWidth + window.scrollX;
    } else {
      left = rect.left + window.scrollX;
    }

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - contentWidth - 8));

    setPos({ top, left });
  }, [open, side, align, sideOffset, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={className}
      style={{
        position: 'fixed',
        zIndex: 9999,
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        transform: side === 'top' ? 'translateY(-100%)' : undefined,
        pointerEvents: 'auto',
      }}
    >
      {children}
    </div>
  );
}

function HoverCardPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return ReactDOM.createPortal(children, document.body);
}

export { HoverCardRoot, HoverCardTrigger, HoverCardContent, HoverCardPortal };
