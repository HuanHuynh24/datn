import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react';

interface DropdownProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: ReactNode;
  children: ReactNode;
  className?: string;
  triggerClassName?: string;
  panelClassName?: string;
  active?: boolean;
  align?: 'start' | 'end';
}

/** A disclosure with normal tab order, outside dismissal and viewport-safe positioning. */
export default function Dropdown({ open, onOpenChange, label, children, className = '', triggerClassName = '', panelClassName = '', active, align = 'start' }: DropdownProps) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dismissOutside = (event: Event) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) onOpenChange(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onOpenChange(false);
      trigger.current?.focus();
    };
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) return;
    const position = () => {
      const element = panel.current;
      if (!element) return;
      element.style.transform = '';
      const bounds = element.getBoundingClientRect();
      const shift = bounds.right > window.innerWidth - 16
        ? window.innerWidth - 16 - bounds.right
        : bounds.left < 16 ? 16 - bounds.left : 0;
      element.style.transform = `translateX(${shift}px)`;
    };
    position();
    window.addEventListener('resize', position);
    return () => window.removeEventListener('resize', position);
  }, [open]);

  return <div ref={root} className={`cl-dropdown ${className}`} data-open={open || undefined}>
    <button ref={trigger} id={`${id}-trigger`} type="button" className={triggerClassName} aria-expanded={open} aria-controls={`${id}-panel`} aria-current={active ? 'page' : undefined} onClick={() => onOpenChange(!open)}>
      {label}
    </button>
    {open && <div ref={panel} id={`${id}-panel`} className={`cl-dropdown-panel ${panelClassName}`} data-align={align} role="group" aria-labelledby={`${id}-trigger`}>
      {children}
    </div>}
  </div>;
}
