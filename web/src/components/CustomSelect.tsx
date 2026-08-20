import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CustomSelectOption[];
  placeholder?: string;
}

type MenuPosition = { top: number; left: number; width: number };

// A div-built dropdown standing in for a native <select> wherever the options list itself needs
// full styling (hover/selected states) that a real <select>'s <option> list can't take on any
// browser. value/onChange/options carry exactly the same meaning as a native select's — callers
// just pass the resolved string value straight to onChange instead of reading event.target.value.
export function CustomSelect({ id, value, onChange, options, placeholder }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // The options panel is positioned via `fixed` + a live getBoundingClientRect() snapshot of the
  // trigger, rather than `absolute` relative to a positioned ancestor — an `absolute` panel gets
  // clipped by any ancestor with overflow set to anything but `visible` (e.g. the filter bar's
  // own horizontally-scrollable row), which `fixed` positioned against the viewport escapes.
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }

  useEffect(() => {
    if (!isOpen) return undefined;

    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }
    // A `fixed` panel doesn't move with the page, so it would visually detach from the trigger
    // on scroll — closing on scroll/resize is simpler and safer than re-measuring continuously.
    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const selected = options.find((option) => option.value === value);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          width: '100%',
          border: isFocused || isOpen ? '1.5px solid #6D28D9' : '1.5px solid #E2E8F0',
          borderRadius: '10px',
          padding: '8px 14px',
          fontSize: '14px',
          color: '#1E293B',
          backgroundColor: 'white',
          cursor: 'pointer',
          minWidth: '180px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          outline: 'none',
          textAlign: 'left',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.label : (placeholder ?? 'Select…')}
        </span>
        <ChevronDown
          size={16}
          style={{
            flexShrink: 0,
            color: '#64748B',
            transition: 'transform 0.15s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      <div
        role="listbox"
        style={{
          position: 'fixed',
          top: menuPosition ? `${menuPosition.top}px` : 0,
          left: menuPosition ? `${menuPosition.left}px` : 0,
          minWidth: menuPosition ? `${menuPosition.width}px` : undefined,
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          zIndex: 9999,
          opacity: isOpen ? 1 : 0,
          visibility: isOpen ? 'visible' : 'hidden',
          transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
          transition: 'opacity 0.12s ease, transform 0.12s ease, visibility 0.12s',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <div
              key={option.value}
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                fontSize: '14px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                backgroundColor: isSelected ? '#EDE9FE' : 'white',
                color: isSelected ? '#6D28D9' : '#1E293B',
                fontWeight: isSelected ? 600 : 400,
                transition: 'background-color 0.1s ease',
              }}
              onMouseEnter={(event) => {
                if (!isSelected) event.currentTarget.style.backgroundColor = '#F5F3FF';
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.backgroundColor = isSelected ? '#EDE9FE' : 'white';
              }}
            >
              {option.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
