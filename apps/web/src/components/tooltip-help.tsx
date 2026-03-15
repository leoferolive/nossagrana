import { useState } from 'react';

interface TooltipHelpProps {
  text: string;
  className?: string;
}

export const TooltipHelp = ({ text, className = '' }: TooltipHelpProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        aria-label="ajuda"
        onClick={() => setVisible((v) => !v)}
        className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground hover:bg-muted/70 focus:outline-none"
      >
        ?
      </button>
      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-1 w-56 -translate-x-1/2 rounded-lg bg-popover p-2 text-xs text-popover-foreground shadow-md"
        >
          {text}
        </span>
      )}
    </span>
  );
};
