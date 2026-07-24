'use client';

import type { ParsedLayer } from '@/lib/psd';

interface LayerPanelProps {
    layers: ParsedLayer[];
    hiddenIds: Set<string>;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onToggleVisibility: (id: string) => void;
}

export default function LayerPanel({ layers, hiddenIds, selectedId, onSelect, onToggleVisibility }: LayerPanelProps) {
    // psd.ts returns layers bottom-to-top (matching the PSD file's own
    // record order), but a layer panel should read the way Photoshop's
    // does — frontmost layer listed first — so this reverses for display
    // only; canvas stacking uses the original bottom-to-top order.
    const topFirst = [...layers].reverse();

    return (
        <div className="flex h-full flex-col">
            <div className="border-b border-black/10 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-black/50">Layers</p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
                {topFirst.map((layer) => {
                    const isHidden = hiddenIds.has(layer.id);
                    const isSelected = layer.id === selectedId;
                    return (
                        <button
                            key={layer.id}
                            onClick={() => onSelect(layer.id)}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${
                                isSelected ? 'bg-black text-white' : 'hover:bg-black/5 text-black/80'
                            }`}
                        >
                            <span
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleVisibility(layer.id);
                                }}
                                className={`shrink-0 text-xs ${isSelected ? 'text-white/70' : 'text-black/40'}`}
                                title={isHidden ? 'Show layer' : 'Hide layer'}
                            >
                                {isHidden ? '◌' : '●'}
                            </span>
                            <span className="h-7 w-7 shrink-0 overflow-hidden rounded border border-black/10 bg-[repeating-conic-gradient(#e5e5e5_0%_25%,white_0%_50%)] bg-[length:8px_8px]">
                                {layer.thumbnailUrl && (
                                    <img src={layer.thumbnailUrl} alt="" className="h-full w-full object-contain" />
                                )}
                            </span>
                            <span className={`truncate ${isHidden ? 'opacity-40 line-through' : ''}`}>
                                {layer.name}
                            </span>
                            {!layer.hasVisiblePixels && (
                                <span
                                    className={`ml-auto shrink-0 text-[10px] uppercase tracking-wide ${isSelected ? 'text-white/50' : 'text-red-500/70'}`}
                                    title="This layer has no visible pixels"
                                >
                                    empty
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}