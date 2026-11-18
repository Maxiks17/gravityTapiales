import React, { useRef, useState } from 'react';
import type { Area, Table } from '../../types/operationMode';

interface AreaMapProps {
    areas: Area[];
    tables?: Table[]; // To render mini-maps
    readOnly?: boolean;
    onAreaClick?: (area: Area) => void;
    onAreaDoubleClick?: (area: Area) => void;
    onAreaMove?: (areaId: string, x: number, y: number) => void;
    width?: number; // Grid width
    height?: number; // Grid height
    gridSize?: number; // Pixel size of one grid unit
    renderContent?: (area: Area) => React.ReactNode;
}

const AreaMap: React.FC<AreaMapProps> = ({
    areas,
    // tables = [], // Removing used prop to fix lint error if not used in AreaMap logic directly (it is used in renderContent pass-through but only if invoked by parent)
    // Actually renderContent uses it via closure in parent. AreaMap doesn't use it.
    readOnly = false,
    onAreaClick,
    onAreaDoubleClick,
    onAreaMove,
    width = 20,
    height = 20,
    gridSize = 40,
    renderContent
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent, area: Area) => {
        if (readOnly) {
            onAreaClick?.(area);
            return;
        }

        // Start dragging
        setDraggingId(area.id);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!draggingId || readOnly || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();

        // Calculate new grid position
        const x = e.clientX - containerRect.left - dragOffset.x;
        const y = e.clientY - containerRect.top - dragOffset.y;

        let gridX = Math.round(x / gridSize);
        let gridY = Math.round(y / gridSize);

        // Clamp to grid
        gridX = Math.max(0, Math.min(gridX, width - 1));
        gridY = Math.max(0, Math.min(gridY, height - 1));

        onAreaMove?.(draggingId, gridX, gridY);
    };

    const handleMouseUp = () => {
        if (draggingId && onAreaClick) {
            const area = areas.find(a => a.id === draggingId);
            if (area) onAreaClick(area);
        }
        setDraggingId(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative bg-muted/20 border border-border rounded-lg overflow-hidden shadow-inner"
            style={{
                width: width * gridSize,
                height: height * gridSize,
                backgroundImage: 'radial-gradient(var(--color-grid-dot) 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`
            }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {areas.map(area => {
                const isDragging = draggingId === area.id;

                return (
                    <div
                        key={area.id}
                        onMouseDown={(e) => handleMouseDown(e, area)}
                        onDoubleClick={() => onAreaDoubleClick?.(area)}
                        style={{
                            position: 'absolute',
                            left: (area.position_x || 0) * gridSize,
                            top: (area.position_y || 0) * gridSize,
                            width: (area.width || 4) * gridSize, // Default larger for areas
                            height: (area.height || 4) * gridSize,
                            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: isDragging ? 10 : 1,
                            cursor: readOnly ? 'pointer' : 'grab',
                        }}
                        className={`
                            group flex flex-col items-center justify-center p-1 rounded-md
                            bg-card border-2 border-primary/20 hover:border-primary shadow-sm
                        `}
                    >
                        {/* Header */}
                        <div className="w-full text-center border-b border-border/50 pb-1 mb-1">
                            <span className="font-bold text-foreground text-xs sm:text-sm truncate block">
                                {area.name}
                            </span>
                        </div>

                        {/* Content (Mini Map) */}
                        <div className="flex-1 w-full relative overflow-hidden bg-muted/30 rounded">
                            {renderContent ? renderContent(area) : (
                                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                                    {area.name}
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default AreaMap;
