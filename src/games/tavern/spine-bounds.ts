import {
  MixBlend, MixDirection, Physics, Skeleton, Vector2,
  type Event as SpineEvent, type Slot,
} from "@esotericsoftware/spine-pixi-v8";

export function animationBounds(
  data: Skeleton["data"],
  animations: string[],
  include: (slot: Slot) => boolean = () => true,
) {
  const preview = new Skeleton(data);
  const offset = new Vector2();
  const size = new Vector2();
  const events: SpineEvent[] = [];
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const name of animations) {
    const clip = data.findAnimation(name);
    if (!clip) continue;
    for (let frame = 0; frame <= 32; frame++) {
      const time = (clip.duration * frame) / 32;
      preview.setToSetupPose();
      events.length = 0;
      clip.apply(preview, time, time, false, events, 1, MixBlend.setup, MixDirection.mixIn);
      preview.updateWorldTransform(Physics.pose);
      for (const slot of preview.drawOrder)
        if (slot.color.a <= 0.01 || !include(slot)) slot.setAttachment(null);
      preview.getBounds(offset, size);
      if (!Number.isFinite(size.x + size.y) || size.x <= 0 || size.y <= 0) continue;
      left = Math.min(left, offset.x);
      top = Math.min(top, offset.y);
      right = Math.max(right, offset.x + size.x);
      bottom = Math.max(bottom, offset.y + size.y);
    }
  }
  if (right <= left || bottom <= top) return;
  return { x: left, y: top, width: right - left, height: bottom - top };
}
