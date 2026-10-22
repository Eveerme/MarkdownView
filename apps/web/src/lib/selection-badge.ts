export interface SelectionRect {
  bottom: number;
  right: number;
  top: number;
}

export interface BadgeViewport {
  height: number;
  width: number;
}

export interface SelectionBadgePlacement {
  left: number;
  top: number;
}

// The badge's own type and padding fix its size, so the clamp can reserve room
// for it without measuring a node that is not on screen yet.
const badgeHeight = 24;
const badgeWidth = 76;
const gap = 6;
const edge = 8;

/**
 * Where the floating count sits: at the lower right of the last selected line,
 * flipped above the line and pulled inside the window when it would cross an
 * edge.
 */
export const placeSelectionBadge = (
  rect: SelectionRect,
  viewport: BadgeViewport
): SelectionBadgePlacement => {
  const below = rect.bottom + gap;

  const top =
    below + badgeHeight > viewport.height
      ? Math.max(edge, rect.top - gap - badgeHeight)
      : below;

  const left = Math.min(
    Math.max(rect.right + gap, edge),
    Math.max(edge, viewport.width - badgeWidth - edge)
  );

  return { left, top };
};
