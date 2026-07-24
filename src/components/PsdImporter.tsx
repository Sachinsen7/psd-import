'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { parsePsdFile, type ParsedPsd } from '@/lib/psd';
import LayerPanel from './LayerPanel';

const CANVAS_MAX_WIDTH = 820;
const CANVAS_MAX_HEIGHT = 560;

export default function PsdImporter() {
    const [parsed, setParsed] = useState<ParsedPsd | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);

    const canvasElRef = useRef<HTMLCanvasElement>(null);
    const fabricRef = useRef<fabric.Canvas | null>(null);
    const objectsByLayerId = useRef<Map<string, fabric.Image>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const canvas = new fabric.Canvas(canvasElRef.current!, {
            preserveObjectStacking: true,
            selection: true,
        });
        fabricRef.current = canvas;

        canvas.on('selection:created', (event) => setSelectedFromFabric(event));
        canvas.on('selection:updated', (event) => setSelectedFromFabric(event));
        canvas.on('selection:cleared', () => setSelectedId(null));

        return () => {
            canvas.dispose();
        };
    }, []);

    const setSelectedFromFabric = (event: { selected?: fabric.Object[] }) => {
        const target = event.selected?.[0] as (fabric.Object & { layerId?: string }) | undefined;
        setSelectedId(target?.layerId ?? null);
    };

    const buildCanvasFromParsedPsd = useCallback((data: ParsedPsd) => {
        const canvas = fabricRef.current;
        if (!canvas) return;

        canvas.clear();
        objectsByLayerId.current.clear();

        const scale = Math.min(CANVAS_MAX_WIDTH / data.width, CANVAS_MAX_HEIGHT / data.height, 1);
        canvas.setWidth(data.width * scale);
        canvas.setHeight(data.height * scale);
        canvas.setZoom(scale);

        const background = new fabric.Rect({
            left: 0,
            top: 0,
            width: data.width,
            height: data.height,
            fill: '#ffffff',
            selectable: false,
            evented: false,
            name: 'background',
        });
        canvas.add(background);

        // PSD layer records are stored bottom-to-top, so psd.ts already
        // returns data.layers in that same order — adding them as-is means
        // the bottommost layer is added (and rendered) first, matching
        // fabric's last-added-is-frontmost stacking rule.
        data.layers.forEach((layer) => {
            const image = new fabric.Image(layer.canvas, {
                left: layer.left,
                top: layer.top,
                opacity: layer.opacity,
                visible: !layer.hidden,
                name: layer.name,
            });
            (image as fabric.Image & { layerId?: string }).layerId = layer.id;
            objectsByLayerId.current.set(layer.id, image);
            canvas.add(image);
        });

        canvas.renderAll();
        setZoom(scale);
    }, []);

    const handleFile = async (file: File) => {
        if (!file.name.toLowerCase().endsWith('.psd')) {
            setError('Please choose a .psd file.');
            return;
        }
        setError('');
        setLoading(true);
        try {
            const data = await parsePsdFile(file);
            setParsed(data);
            setHiddenIds(new Set(data.layers.filter((l) => l.hidden).map((l) => l.id)));
            setSelectedId(null);
            buildCanvasFromParsedPsd(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not read this PSD file.');
            setParsed(null);
        } finally {
            setLoading(false);
        }
    };

    const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void handleFile(file);
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        const file = event.dataTransfer.files?.[0];
        if (file) void handleFile(file);
    };

    const selectLayer = (id: string) => {
        const canvas = fabricRef.current;
        const object = objectsByLayerId.current.get(id);
        if (!canvas || !object) return;
        canvas.setActiveObject(object);
        canvas.renderAll();
        setSelectedId(id);
    };

    const toggleVisibility = (id: string) => {
        const canvas = fabricRef.current;
        const object = objectsByLayerId.current.get(id);
        if (!canvas || !object) return;

        setHiddenIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                object.set({ visible: true });
            } else {
                next.add(id);
                object.set({ visible: false });
                if (selectedId === id) {
                    canvas.discardActiveObject();
                    setSelectedId(null);
                }
            }
            canvas.renderAll();
            return next;
        });
    };

    const deleteSelected = () => {
        const canvas = fabricRef.current;
        const active = canvas?.getActiveObject() as (fabric.Object & { layerId?: string }) | undefined;
        if (!canvas || !active?.layerId) return;
        canvas.remove(active);
        objectsByLayerId.current.delete(active.layerId);
        setParsed((prev) =>
            prev ? { ...prev, layers: prev.layers.filter((layer) => layer.id !== active.layerId) } : prev
        );
        setSelectedId(null);
    };

    const applyZoom = (next: number) => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const clamped = Math.max(0.1, Math.min(3, next));
        canvas.setZoom(clamped);
        if (parsed) {
            canvas.setWidth(parsed.width * clamped);
            canvas.setHeight(parsed.height * clamped);
        }
        canvas.renderAll();
        setZoom(clamped);
    };

    const startOver = () => {
        setParsed(null);
        setError('');
        setSelectedId(null);
        fabricRef.current?.clear();
    };

    return (
        <section id="import" className="mx-auto max-w-6xl px-6 py-16">
            <div className="overflow-hidden rounded-3xl border border-black/10 bg-white shadow-sm">
                {parsed && (
                    <div className="flex items-center justify-between border-b border-black/10 px-5 py-3">
                        <div>
                            <p className="text-sm font-semibold">{parsed.fileName}</p>
                            <p className="text-xs text-black/50">
                                {parsed.width} × {parsed.height}px · {parsed.layers.length} layer
                                {parsed.layers.length === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => applyZoom(zoom - 0.1)}
                                className="h-8 w-8 rounded-full border border-black/10 text-sm hover:bg-black/5"
                            >
                                −
                            </button>
                            <span className="w-12 text-center text-xs text-black/50">{Math.round(zoom * 100)}%</span>
                            <button
                                onClick={() => applyZoom(zoom + 0.1)}
                                className="h-8 w-8 rounded-full border border-black/10 text-sm hover:bg-black/5"
                            >
                                +
                            </button>
                            <button
                                onClick={deleteSelected}
                                disabled={!selectedId}
                                className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold hover:bg-black/5 disabled:opacity-30"
                            >
                                Delete layer
                            </button>
                            <button
                                onClick={startOver}
                                className="rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-black/80"
                            >
                                Import another
                            </button>
                        </div>
                    </div>
                )}
                <div className="flex flex-col md:flex-row">
                    <div className="relative flex min-h-[420px] flex-1 items-center justify-center overflow-auto bg-[#eceef1] p-6">
                        <canvas ref={canvasElRef} className={parsed ? '' : 'hidden'} />
                        {!parsed && (
                            <div
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={onDrop}
                                className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-black/15 bg-white px-8 py-16 text-center"
                            >
                                <p className="text-lg font-semibold">Drop a PSD file here</p>
                                <p className="text-sm text-black/50">or choose one from your computer</p>
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={loading}
                                    className="mt-2 rounded-full bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/80 disabled:opacity-50"
                                >
                                    {loading ? 'Reading file…' : 'Choose PSD file'}
                                </button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".psd"
                                    className="hidden"
                                    onChange={onFileInputChange}
                                />
                                {error && <p className="text-sm font-medium text-red-600">{error}</p>}
                            </div>
                        )}
                    </div>
                    {parsed && (
                        <div className="w-full border-t border-black/10 md:w-64 md:border-l md:border-t-0">
                            <LayerPanel
                                layers={parsed.layers}
                                hiddenIds={hiddenIds}
                                selectedId={selectedId}
                                onSelect={selectLayer}
                                onToggleVisibility={toggleVisibility}
                            />
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
