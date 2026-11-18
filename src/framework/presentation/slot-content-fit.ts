/** Fit a centered slot attachment inside a viewport, including animated rotation/scale. */
export function slotContentScale(
  content: { width: number; height: number },
  bone: { a: number; b: number; c: number; d: number; worldX: number; worldY: number },
  screen: { x: number; y: number; scaleX: number; scaleY: number },
  viewport: { width: number; height: number },
  padding: number,
) {
  const x = screen.x + bone.worldX * screen.scaleX;
  const y = screen.y + bone.worldY * screen.scaleY;
  const width = (Math.abs(bone.a) * content.width + Math.abs(bone.b) * content.height) * Math.abs(screen.scaleX);
  const height = (Math.abs(bone.c) * content.width + Math.abs(bone.d) * content.height) * Math.abs(screen.scaleY);
  const availableWidth = Math.max(0, 2 * Math.min(x - padding, viewport.width - padding - x));
  const availableHeight = Math.max(0, 2 * Math.min(y - padding, viewport.height - padding - y));
  return Math.min(1, width ? availableWidth / width : 1, height ? availableHeight / height : 1);
}
