import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Brand-animated CTA: gradient base, glossy border, floating dots, arrow dash on hover.
 * Use <FancyButton> for buttons or <FancyShell> children inside any element (e.g. <Link>).
 */
export function FancyShell({ children, showArrow = true }: { children: ReactNode; showArrow?: boolean }) {
  return (
    <>
      <span className="fancy-points" aria-hidden="true">
        {Array.from({ length: 10 }).map((_, i) => (
          <i key={i} className="fancy-point" />
        ))}
      </span>
      <span className="fancy-inner">
        {children}
        {showArrow && (
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}>
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        )}
      </span>
    </>
  );
}

type FancyButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  showArrow?: boolean;
};

export const FancyButton = forwardRef<HTMLButtonElement, FancyButtonProps>(
  ({ className, children, showArrow = true, ...props }, ref) => (
    <button ref={ref} className={cn("fancy-btn", className)} {...props}>
      <FancyShell showArrow={showArrow}>{children}</FancyShell>
    </button>
  ),
);
FancyButton.displayName = "FancyButton";
