import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FC,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

// Building blocks for a macOS System Settings style page: titled groups of rows, each row a
// label (with an optional explanation) on the left and its control on the right.

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  description: string;
  recommended?: boolean;
}

// Large frames: same edge as the capsule controls, a quiet fill.
export const glassFrame =
  'rounded-[22px] border border-black/10 bg-muted/70 dark:border-white/15 dark:bg-white/[0.06]';

export const SettingsGroup: FC<{
  title?: string;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}> = ({ title, description, footer, children }) => (
  <section className="space-y-1.5">
    {(title !== undefined || description !== undefined) && (
      <div className="px-4">
        {title && (
          <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    )}
    {/* No backdrop-filter here: it would start a stacking context that hides open menus
        behind the next group. */}
    <div
      className={`divide-y divide-black/5 ${glassFrame} dark:divide-white/10`}
    >
      {children}
    </div>
    {footer && (
      <div className="flex items-start gap-1.5 px-4 text-xs leading-5 text-muted-foreground">
        <span className="flex h-5 shrink-0 items-center">
          <Info className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 flex-1">{footer}</div>
      </div>
    )}
  </section>
);

export const SettingsRow: FC<{
  label: ReactNode;
  description?: ReactNode;
  htmlFor?: string;
  error?: string;
  // Wide controls (text fields) go under the label instead of beside it.
  stacked?: boolean;
  children?: ReactNode;
}> = ({ label, description, htmlFor, error, stacked = false, children }) => (
  <div
    className={cn(
      'flex gap-x-6 gap-y-2 px-4 py-3',
      stacked ? 'flex-col' : 'flex-col sm:flex-row sm:items-center',
    )}
  >
    <div className="min-w-0 flex-1">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {description && (
        <div className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {description}
        </div>
      )}
    </div>
    {children && (
      <div className={cn(stacked ? 'w-full' : 'shrink-0')}>{children}</div>
    )}
    {error && <p className="text-xs text-destructive">{error}</p>}
  </div>
);

export const glassControl =
  'border border-black/10 bg-white/60 shadow-sm backdrop-blur-md transition-colors hover:bg-white/80 dark:border-white/15 dark:bg-white/10 dark:hover:bg-white/15';

// Capsule buttons and fields that match the pop-up buttons.
export const glassButton = `rounded-full ${glassControl} h-8 px-3.5 text-sm font-medium`;
export const glassField = `rounded-full ${glassControl} h-8 px-3.5`;

const MENU_OUT_MS = 140;

// Open/close state for a pop-up menu: closes on an outside click and stays mounted for a
// short exit animation.
export const usePopover = () => {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setClosing(true);
    timer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, MENU_OUT_MS);
  }, []);
  const show = useCallback(() => {
    clearTimeout(timer.current);
    setClosing(false);
    setOpen(true);
  }, []);
  useEffect(() => {
    if (!open || closing) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) hide();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, closing, hide]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { ref, open, closing, shown: open && !closing, show, hide };
};

// iOS-style: the menu grows out of its button and settles, and shrinks away on close.
export const menuMotion = (closing: boolean, above = false) =>
  closing
    ? above
      ? 'animate-[menu-out-up_140ms_ease-in_forwards]'
      : 'animate-[menu-out_140ms_ease-in_forwards]'
    : above
      ? 'animate-[menu-in-up_280ms_cubic-bezier(0.32,0.72,0,1)]'
      : 'animate-[menu-in_280ms_cubic-bezier(0.32,0.72,0,1)]';

// A capsule button that opens a frosted menu, like the pop-up buttons in macOS settings.
// Each choice shows its explanation, so the menu itself says what an option does.
export const SettingsSelect = <T extends string>({
  id,
  value,
  onChange,
  options,
}: {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: PickerOption<T>[];
}) => {
  const menu = usePopover();
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const [active, setActive] = useState(selectedIndex);

  // Open upwards when the menu would run under the Save bar (or off the screen) below.
  const [above, setAbove] = useState(false);
  const openMenu = () => {
    const button = menu.ref.current?.getBoundingClientRect();
    const limit =
      document.querySelector('footer')?.getBoundingClientRect().top ??
      window.innerHeight;
    const menuHeight = options.length * 64 + 16;
    setAbove(
      !!button &&
        button.bottom + menuHeight > limit &&
        button.top - menuHeight > 0,
    );
    setActive(selectedIndex);
    menu.show();
  };
  const choose = (next: T) => {
    onChange(next);
    menu.hide();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!menu.shown) return openMenu();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + options.length) % options.length);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (menu.shown) choose(options[active].value);
      else openMenu();
    } else if ((e.key === 'Escape' || e.key === 'Tab') && menu.shown) {
      menu.hide();
    }
  };

  return (
    <div ref={menu.ref} className="relative">
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={menu.shown}
        onClick={() => (menu.shown ? menu.hide() : openMenu())}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex h-8 min-w-44 items-center justify-between gap-3 rounded-full px-3.5 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          glassControl,
        )}
      >
        <span>{options[selectedIndex]?.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 opacity-60 transition-transform duration-300',
            menu.shown && (above ? '-rotate-180' : 'rotate-180'),
          )}
        />
      </button>
      {menu.open && (
        <ul
          role="listbox"
          aria-labelledby={id}
          className={cn(
            'absolute right-0 z-30 w-80 space-y-0.5 rounded-2xl p-1.5 border border-black/10 bg-white/80 shadow-2xl backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-zinc-900/80',
            above
              ? 'bottom-full mb-2 origin-bottom-right'
              : 'top-full mt-2 origin-top-right',
            menuMotion(menu.closing, above),
          )}
        >
          {options.map((option, i) => {
            const isActive = i === active;
            return (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(option.value)}
                className={cn(
                  'flex cursor-default gap-2 rounded-xl px-2.5 py-2',
                  isActive && 'bg-blue-500 text-white',
                )}
              >
                <Check
                  className={cn(
                    'mt-0.5 h-4 w-4 shrink-0',
                    option.value !== value && 'invisible',
                  )}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {option.label}
                    {option.recommended && (
                      <span
                        className={cn(
                          'rounded-full px-1.5 text-[10px] font-semibold tracking-wide uppercase',
                          isActive
                            ? 'bg-white/25 text-white'
                            : 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
                        )}
                      >
                        Recommended
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      'text-xs leading-5',
                      isActive ? 'text-white/85' : 'text-muted-foreground',
                    )}
                  >
                    {option.description}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export const SettingsSlider: FC<{
  id?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}> = ({ id, value, min, max, step, unit, onChange }) => (
  <div className="flex w-full items-center gap-3 sm:w-80">
    <input
      id={id}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="glass-range flex-1"
      style={
        { '--fill': `${((value - min) / (max - min)) * 100}%` } as CSSProperties
      }
    />
    <span
      className={cn(
        'w-20 rounded-full py-1 text-center text-sm tabular-nums',
        glassControl,
      )}
    >
      {value} {unit}
    </span>
  </div>
);

export const optionDescription = <T extends string>(
  options: PickerOption<T>[],
  value: T,
) => options.find((option) => option.value === value)?.description;

export const Switch: FC<{
  id?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}> = ({ id, checked, onCheckedChange }) => (
  <button
    id={id}
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
      checked ? 'bg-blue-500' : 'bg-input',
    )}
  >
    <span
      className={cn(
        'inline-block h-5 w-5 rounded-full bg-white shadow transition-transform',
        checked ? 'translate-x-[18px]' : 'translate-x-0.5',
      )}
    />
  </button>
);
