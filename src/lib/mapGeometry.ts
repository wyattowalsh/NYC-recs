interface Box { left: number; right: number; top: number; bottom: number }
interface MapPan { panBy(offset: [number, number], options: { animate: boolean; duration: number }): unknown }

export function panPopupIntoView(map: MapPan, popup: Box, viewport: Box, reducedMotion: boolean) {
  const gap = 16;
  const dx = popup.left < viewport.left + gap ? popup.left - viewport.left - gap : popup.right > viewport.right - gap ? popup.right - viewport.right + gap : 0;
  const dy = popup.top < viewport.top + gap ? popup.top - viewport.top - gap : popup.bottom > viewport.bottom - gap ? popup.bottom - viewport.bottom + gap : 0;
  if (dx || dy) map.panBy([dx, dy], { animate: !reducedMotion, duration: .2 });
}
