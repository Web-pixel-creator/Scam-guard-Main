// The accessibility panel lives in the root layout, outside the header. On
// phones and tablets its floating button is hidden and the mobile menu opens
// the panel through this window event instead.
export const OPEN_A11Y_PANEL_EVENT = "ig:open-a11y-panel";

export function requestA11yPanel(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(OPEN_A11Y_PANEL_EVENT));
}
