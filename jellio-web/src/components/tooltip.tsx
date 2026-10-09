import { useState, type FC, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils.ts';

// A small capsule label in the page's own style, used instead of the browser's tooltip.
// It is drawn in a portal so a clipping parent (the collapsing sidebar) can't cut it off.
export const Tip: FC<{
  label: string;
  side?: 'right' | 'bottom';
  // Bottom tips start at the left edge of the control instead of centring on it.
  align?: 'center' | 'start';
  enabled?: boolean;
  className?: string;
  children: ReactNode;
}> = ({
  label,
  side = 'bottom',
  align = 'center',
  enabled = true,
  className,
  children,
}) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const show = (e: { currentTarget: HTMLElement }) =>
    setRect(e.currentTarget.getBoundingClientRect());
  const hide = () => setRect(null);
  const style =
    rect &&
    (side === 'right'
      ? { left: rect.right + 10, top: rect.top + rect.height / 2 }
      : {
          left: align === 'start' ? rect.left : rect.left + rect.width / 2,
          top: rect.bottom + 8,
        });
  return (
    <div
      className={className}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {enabled &&
        style &&
        createPortal(
          <span
            role="tooltip"
            style={style}
            className={cn(
              'pointer-events-none fixed z-50 animate-[tip-in_160ms_ease-out] rounded-full border border-black/10 bg-white/85 px-3 py-1 text-xs font-medium whitespace-nowrap text-foreground shadow-lg backdrop-blur-xl dark:border-white/15 dark:bg-zinc-900/85',
              side === 'right' && '-translate-y-1/2',
              side === 'bottom' && align === 'center' && '-translate-x-1/2',
            )}
          >
            {label}
          </span>,
          document.body,
        )}
    </div>
  );
};
