import { readPsd, type Layer } from 'ag-psd';

export interface ParsedLayer {
    id: string;
    name: string;
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
    hidden: boolean;
    canvas: HTMLCanvasElement;
    thumbnailUrl: string;
    hasVisiblePixels: boolean;
}

function makeProbe(source: HTMLCanvasElement): { thumbnailUrl: string; hasVisiblePixels: boolean } {
    if (source.width === 0 || source.height === 0) {
        return { thumbnailUrl: '', hasVisiblePixels: false };
    }
    const probe = document.createElement('canvas');
    probe.width = 32;
    probe.height = 32;
    const ctx = probe.getContext('2d');
    if (!ctx) return { thumbnailUrl: '', hasVisiblePixels: false };

    ctx.drawImage(source, 0, 0, 32, 32);
    const { data } = ctx.getImageData(0, 0, 32, 32);
    let hasVisiblePixels = false;
    for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 8) {
            hasVisiblePixels = true;
            break;
        }
    }
    return { thumbnailUrl: probe.toDataURL(), hasVisiblePixels };
}

export interface ParsedPsd {
    fileName: string;
    width: number;
    height: number;
    layers: ParsedLayer[];
}

const normalizeOpacity = (value: number | undefined): number => {
    if (value == null) return 1;
    return value > 1 ? value / 255 : value;
};

const colorToCss = (color: { r?: number; g?: number; b?: number } | undefined): string =>
    color ? `rgb(${Math.round(color.r ?? 0)}, ${Math.round(color.g ?? 0)}, ${Math.round(color.b ?? 0)})` : '#111111';

function renderTextLayer(layer: Layer, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    const style = layer.text?.style;
    if (ctx && layer.text?.text) {
        const fontSize = style?.fontSize ?? 24;
        ctx.font = `${fontSize}px ${style?.font?.name || 'sans-serif'}`;
        ctx.fillStyle = colorToCss(style?.fillColor as { r?: number; g?: number; b?: number } | undefined);
        ctx.textBaseline = 'top';
        ctx.fillText(layer.text.text, 0, 0, canvas.width);
    }
    return canvas;
}

function renderPlaceholderLayer(name: string, width: number, height: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width);
    canvas.height = Math.max(1, height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = 'rgba(17, 24, 39, 0.06)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(17, 24, 39, 0.35)';
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
        ctx.fillStyle = 'rgba(17, 24, 39, 0.45)';
        ctx.font = '12px sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(name, 6, 6, canvas.width - 12);
    }
    return canvas;
}

function resolveLayerBounds(layer: Layer): { left: number; top: number; width: number; height: number } {
    const outerWidth = (layer.right ?? 0) - (layer.left ?? 0);
    const outerHeight = (layer.bottom ?? 0) - (layer.top ?? 0);
    if (outerWidth > 1 && outerHeight > 1) {
        return { left: layer.left ?? 0, top: layer.top ?? 0, width: outerWidth, height: outerHeight };
    }

    const text = layer.text;
    const textWidth = (text?.right ?? 0) - (text?.left ?? 0);
    const textHeight = (text?.bottom ?? 0) - (text?.top ?? 0);
    if (text && textWidth > 1 && textHeight > 1) {
        return { left: text.left ?? 0, top: text.top ?? 0, width: textWidth, height: textHeight };
    }


    if (text?.text) {
        const fontSize = text.style?.fontSize ?? 24;
        return {
            left: layer.left ?? 0,
            top: layer.top ?? 0,
            width: Math.max(80, text.text.length * fontSize * 0.6),
            height: Math.max(24, fontSize * 1.4),
        };
    }

    return { left: layer.left ?? 0, top: layer.top ?? 0, width: Math.max(1, outerWidth), height: Math.max(1, outerHeight) };
}

function applyClipMask(
    clipped: { canvas: HTMLCanvasElement; left: number; top: number },
    base: { canvas: HTMLCanvasElement; left: number; top: number }
): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = clipped.canvas.width;
    out.height = clipped.canvas.height;
    const ctx = out.getContext('2d');
    if (!ctx) return clipped.canvas;

    ctx.drawImage(clipped.canvas, 0, 0);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(base.canvas, base.left - clipped.left, base.top - clipped.top);
    return out;
}

let layerCounter = 0;

interface ResolvedLayer {
    layer: Layer;
    bounds: { left: number; top: number; width: number; height: number };
    canvas: HTMLCanvasElement;
}

function finalizeGroup(resolved: ResolvedLayer[], out: ParsedLayer[]) {
    for (let i = 0; i < resolved.length; i++) {
        const { layer, bounds } = resolved[i];
        let canvas = resolved[i].canvas;

        if (layer.clipping) {
            // PSD layer records are stored bottom-to-top, so resolved[0] is
            // the bottommost layer and index increases going up the stack.
            // A clipped layer's base sits below it — i.e. at a lower index.
            let baseIndex = i - 1;
            while (baseIndex >= 0 && resolved[baseIndex].layer.clipping) baseIndex--;
            const base = baseIndex >= 0 ? resolved[baseIndex] : undefined;
            if (base) {
                canvas = applyClipMask(
                    { canvas, left: bounds.left, top: bounds.top },
                    { canvas: base.canvas, left: base.bounds.left, top: base.bounds.top }
                );
            }
        }

        const { thumbnailUrl, hasVisiblePixels } = makeProbe(canvas);

        out.push({
            id: `layer-${layerCounter++}`,
            name: layer.name || 'Layer',
            left: bounds.left,
            top: bounds.top,
            width: canvas.width,
            height: canvas.height,
            opacity: normalizeOpacity(layer.opacity),
            hidden: Boolean(layer.hidden),
            canvas,
            thumbnailUrl,
            hasVisiblePixels,
        });
    }
}

function collectLayers(layers: Layer[] | undefined, out: ParsedLayer[]) {
    if (!layers) return;

    let pending: ResolvedLayer[] = [];

    for (const layer of layers) {
        if (layer.children) {
            finalizeGroup(pending, out);
            pending = [];
            collectLayers(layer.children, out);
            continue;
        }

        const bounds = resolveLayerBounds(layer);
        const canvas =
            layer.canvas ||
            (layer.text?.text
                ? renderTextLayer(layer, bounds.width, bounds.height)
                : renderPlaceholderLayer(layer.name || 'Layer', bounds.width, bounds.height));

        pending.push({ layer, bounds, canvas });
    }

    finalizeGroup(pending, out);
}

export async function parsePsdFile(file: File): Promise<ParsedPsd> {
    const buffer = await file.arrayBuffer();
    const psd = readPsd(buffer, { skipCompositeImageData: true, skipThumbnail: true });

    if (!psd.width || !psd.height) {
        throw new Error('This file does not look like a valid PSD (missing canvas size).');
    }

    const layers: ParsedLayer[] = [];
    collectLayers(psd.children, layers);

    if (layers.length === 0) {
        throw new Error('No renderable layers were found in this PSD.');
    }

    return {
        fileName: file.name,
        width: psd.width,
        height: psd.height,
        layers,
    };
}
