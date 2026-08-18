import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clampReferenceCrop, createInitialReferenceCrop, normalizedCropToPixels, type NormalizedCrop } from "@/lib/referenceCrop";
import type { CropPixels } from "@/lib/imageCrop";

type ImageSize = { width: number; height: number };
type ImageFrame = { left: number; top: number; width: number; height: number };
type InteractionType = "move" | "nw" | "ne" | "sw" | "se";
type Interaction = { type: InteractionType; pointerId: number; startX: number; startY: number; crop: NormalizedCrop };

const HANDLE_POSITIONS: Record<Exclude<InteractionType, "move">, string> = {
  nw: "-left-2 -top-2",
  ne: "-right-2 -top-2",
  sw: "-left-2 -bottom-2",
  se: "-right-2 -bottom-2",
};

function getImageFrame(container: ImageSize, image: ImageSize): ImageFrame {
  const scale = Math.min(container.width / image.width, container.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  return { left: (container.width - width) / 2, top: (container.height - height) / 2, width, height };
}

export function ReferenceCropper({ image, onCropChange }: { image: string; onCropChange: (crop: CropPixels) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<ImageFrame | null>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [containerSize, setContainerSize] = useState<ImageSize | null>(null);
  const [naturalSize, setNaturalSize] = useState<ImageSize | null>(null);
  const [selection, setSelection] = useState<NormalizedCrop>(createInitialReferenceCrop);

  const frame = useMemo(() => {
    if (!containerSize || !naturalSize) return null;
    return getImageFrame(containerSize, naturalSize);
  }, [containerSize, naturalSize]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    setSelection(createInitialReferenceCrop());
    setNaturalSize(null);
    frameRef.current = null;
  }, [image]);

  const measureContainer = useCallback(() => {
    const element = containerRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setContainerSize({ width: rect.width, height: rect.height });
  }, []);

  useEffect(() => {
    measureContainer();
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureContainer);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureContainer]);

  useEffect(() => {
    if (naturalSize) onCropChange(normalizedCropToPixels(selection, naturalSize.width, naturalSize.height));
  }, [naturalSize, onCropChange, selection]);

  const getNormalizedPoint = (clientX: number, clientY: number) => {
    const currentFrame = frameRef.current;
    if (!currentFrame) return { x: 0, y: 0 };
    return {
      x: (clientX - currentFrame.left) / currentFrame.width,
      y: (clientY - currentFrame.top) / currentFrame.height,
    };
  };

  const startInteraction = (event: React.PointerEvent, type: InteractionType) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    interactionRef.current = { type, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, crop: selection };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const interaction = interactionRef.current;
    const currentFrame = frameRef.current;
    if (!interaction || !currentFrame || interaction.pointerId !== event.pointerId) return;
    const deltaX = (event.clientX - interaction.startX) / currentFrame.width;
    const deltaY = (event.clientY - interaction.startY) / currentFrame.height;
    const start = interaction.crop;
    let next = start;

    if (interaction.type === "move") {
      next = { ...start, x: start.x + deltaX, y: start.y + deltaY };
    } else if (interaction.type === "nw") {
      const right = start.x + start.width;
      const bottom = start.y + start.height;
      const x = Math.min(right - 0.08, Math.max(0, start.x + deltaX));
      const y = Math.min(bottom - 0.08, Math.max(0, start.y + deltaY));
      next = { x, y, width: right - x, height: bottom - y };
    } else if (interaction.type === "ne") {
      const bottom = start.y + start.height;
      const right = Math.min(1, Math.max(start.x + 0.08, start.x + start.width + deltaX));
      const y = Math.min(bottom - 0.08, Math.max(0, start.y + deltaY));
      next = { x: start.x, y, width: right - start.x, height: bottom - y };
    } else if (interaction.type === "sw") {
      const right = start.x + start.width;
      const bottom = Math.min(1, Math.max(start.y + 0.08, start.y + start.height + deltaY));
      const x = Math.min(right - 0.08, Math.max(0, start.x + deltaX));
      next = { x, y: start.y, width: right - x, height: bottom - start.y };
    } else {
      const right = Math.min(1, Math.max(start.x + 0.08, start.x + start.width + deltaX));
      const bottom = Math.min(1, Math.max(start.y + 0.08, start.y + start.height + deltaY));
      next = { ...start, width: right - start.x, height: bottom - start.y };
    }

    setSelection(clampReferenceCrop(next));
  };

  const endInteraction = (event: React.PointerEvent) => {
    if (interactionRef.current?.pointerId === event.pointerId) interactionRef.current = null;
  };

  const cropStyle = frame ? {
    left: frame.left + selection.x * frame.width,
    top: frame.top + selection.y * frame.height,
    width: selection.width * frame.width,
    height: selection.height * frame.height,
  } : undefined;

  return <div ref={containerRef} className="relative w-full h-[60vh] min-h-[320px] bg-[#181818] rounded-2xl overflow-hidden touch-none" onPointerMove={handlePointerMove} onPointerUp={endInteraction} onPointerCancel={endInteraction}>
    <div className="absolute inset-0 bg-black/30 pointer-events-none" />
    <img src={image} alt="Imagem para selecionar o foco" draggable={false} onLoad={(event) => { setNaturalSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight }); measureContainer(); }} className="absolute max-w-none select-none" style={frame ? { left: frame.left, top: frame.top, width: frame.width, height: frame.height } : { visibility: "hidden" }} />
    {cropStyle && <div data-testid="reference-crop-area" className="absolute border-2 border-[#E5D3A2] shadow-[0_0_0_9999px_rgba(0,0,0,0.42)] cursor-move" style={cropStyle} onPointerDown={(event) => startInteraction(event, "move")}>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider text-white/80 pointer-events-none">Arraste para enquadrar</span>
      {(Object.entries(HANDLE_POSITIONS) as Array<[Exclude<InteractionType, "move">, string]>).map(([handle, position]) => <span key={handle} role="button" aria-label={`Ajustar canto ${handle}`} className={`absolute ${position} w-5 h-5 rounded-full bg-[#E5D3A2] border-2 border-black cursor-${handle}-resize`} onPointerDown={(event) => startInteraction(event, handle)} />)}
    </div>}
  </div>;
}
