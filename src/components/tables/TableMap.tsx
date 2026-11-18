import React, { useRef, useState, useEffect } from 'react';
import type { Table } from '../../types/operationMode';
import { Users, UtensilsCrossed, Maximize2 } from 'lucide-react';

interface TableMapProps {
    tables: Table[];
    readOnly?: boolean;
    isEditMode?: boolean;
    onTableClick?: (table: Table) => void;
    onTableDoubleClick?: (table: Table) => void;
    onTableMove?: (tableId: string, x: number, y: number) => void;
    onTableResize?: (tableId: string, width: number, height: number) => void;
    onInteractionEnd?: () => void;
    selectedTableId?: string;
    gridColumns?: number; // Grid columns (default 23)
    gridRows?: number; // Grid rows (default 12)
    minimal?: boolean; // Show only colored shapes
}

const TableMap: React.FC<TableMapProps> = ({
    tables,
    readOnly = false,
    isEditMode = false,
    onTableClick,
    onTableDoubleClick,
    onTableMove,
    onTableResize,
    onInteractionEnd,
    selectedTableId,
    gridColumns = 23,
    gridRows = 12,
    minimal = false,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLDivElement>(null);
    const [gridSize, setGridSize] = useState(40);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [resizingId, setResizingId] = useState<string | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState({ x: 0, y: 0, width: 0, height: 0 });

    // Calculate gridSize based on available space
    useEffect(() => {
        const measure = measureRef.current;
        if (!measure) return;

        const calculateGridSize = () => {
            const rect = measure.getBoundingClientRect();
            if (!rect.width || !rect.height) return;

            // Calculate cell size to fit exactly in the available space
            const cellWidth = rect.width / gridColumns;
            const cellHeight = rect.height / gridRows;
            
            // Use the smaller to maintain square cells
            const newSize = Math.floor(Math.min(cellWidth, cellHeight));
            
            if (newSize > 0) {
                setGridSize(newSize);
            }
        };

        const observer = new ResizeObserver(() => {
            requestAnimationFrame(calculateGridSize);
        });

        observer.observe(measure);
        calculateGridSize(); // Initial calculation

        return () => observer.disconnect();
    }, [gridColumns, gridRows]);

    // Track if mouse moved during drag to differentiate click vs drag
    const [hasMoved, setHasMoved] = useState(false);

    const handleMouseDown = (e: React.MouseEvent, table: Table) => {
        if (readOnly) {
            onTableClick?.(table);
            return;
        }

        // Immediately select the table on mousedown
        onTableClick?.(table);
        
        // Start dragging
        setDraggingId(table.id);
        setHasMoved(false);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const containerRect = containerRef.current.getBoundingClientRect();

        // Handle table move
        if (draggingId && !readOnly && onTableMove) {
            const x = e.clientX - containerRect.left - dragOffset.x;
            const y = e.clientY - containerRect.top - dragOffset.y;

            let gridX = Math.round(x / gridSize);
            let gridY = Math.round(y / gridSize);

            gridX = Math.max(0, Math.min(gridX, gridColumns - 1));
            gridY = Math.max(0, Math.min(gridY, gridRows - 1));

            setHasMoved(true);
            onTableMove(draggingId, gridX, gridY);
        }

        // Handle table resize
        if (resizingId && !readOnly && onTableResize) {
            const deltaX = e.clientX - resizeStartPos.x;
            const deltaY = e.clientY - resizeStartPos.y;

            const deltaGridX = Math.round(deltaX / gridSize);
            const deltaGridY = Math.round(deltaY / gridSize);

            let newWidth = Math.max(1, resizeStartPos.width + deltaGridX);
            let newHeight = Math.max(1, resizeStartPos.height + deltaGridY);

            // Clamp to reasonable size
            newWidth = Math.min(newWidth, 8);
            newHeight = Math.min(newHeight, 8);

            setHasMoved(true);
            onTableResize(resizingId, newWidth, newHeight);
        }
    };

    const handleMouseUp = () => {
        const wasDraggingOrResizing = draggingId !== null || resizingId !== null;
        
        setDraggingId(null);
        setResizingId(null);
        setHasMoved(false);
        
        // Notify parent that interaction ended (only if there was actual movement)
        if (wasDraggingOrResizing && hasMoved && onInteractionEnd) {
            onInteractionEnd();
        }
    };

    const handleDoubleClick = (e: React.MouseEvent, table: Table) => {
        e.stopPropagation();
        onTableDoubleClick?.(table);
    };

    const handleResizeStart = (e: React.MouseEvent, table: Table) => {
        e.stopPropagation();
        if (readOnly) return;

        setResizingId(table.id);
        setResizeStartPos({
            x: e.clientX,
            y: e.clientY,
            width: table.width || 1,
            height: table.height || 1
        });
    };

    // Status colors
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'OCCUPIED': return 'var(--color-table-occupied, #ef4444)';
            case 'WAITING_PAYMENT': return 'var(--color-table-payment, #3b82f6)';
            case 'RESERVED': return 'var(--color-table-reserved, #a855f7)';
            default: return 'var(--color-table-free, #22c55e)';
        }
    };

    return (
        <div
            ref={measureRef}
            className="w-full h-full flex items-center justify-center"
        >
            <div
                ref={containerRef}
                className={`relative bg-muted/20 rounded-lg overflow-hidden shadow-inner border-2 transition-colors duration-200 ${
                    minimal ? 'border-transparent bg-transparent' : 
                    isEditMode ? 'border-primary' : 'border-border'
                }`}
                style={{
                    width: `${gridColumns * gridSize}px`,
                    height: `${gridRows * gridSize}px`,
                    backgroundImage: minimal ? 'none' : 'radial-gradient(var(--color-grid-dot) 1px, transparent 1px)',
                    backgroundSize: `${gridSize}px ${gridSize}px`
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
            {tables.map(table => {
                const isSelected = selectedTableId === table.id;
                const isDragging = draggingId === table.id;

                return (
                    <div
                        key={table.id}
                        onMouseDown={(e) => handleMouseDown(e, table)}
                        onDoubleClick={(e) => handleDoubleClick(e, table)}
                        style={{
                            position: 'absolute',
                            left: table.position_x * gridSize,
                            top: table.position_y * gridSize,
                            width: (table.width || 1) * gridSize,
                            height: (table.height || 1) * gridSize,
                            transition: isDragging ? 'none' : 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: isDragging ? 10 : isSelected ? 5 : 1,
                            cursor: readOnly ? 'pointer' : 'grab',
                        }}
                        className={`
                            group flex flex-col items-center justify-center
                            ${minimal ? 'p-[1px]' : 'p-1'}
                            ${table.shape === 'round' ? 'rounded-full' : 'rounded-md'}
                        `}
                    >
                        {/* Selection highlight overlay - always present, visibility controlled by opacity */}
                        <div 
                            className={`absolute inset-[-4px] rounded-lg pointer-events-none transition-opacity duration-150 ${
                                isSelected ? 'opacity-100' : 'opacity-0'
                            }`}
                            style={{
                                border: '3px solid rgba(99, 102, 241, 0.9)',
                                borderRadius: table.shape === 'round' ? '50%' : '10px',
                            }}
                        />
                        {minimal ? (
                            <div
                                className="w-full h-full opacity-80"
                                style={{
                                    backgroundColor: getStatusColor(table.status),
                                    borderRadius: table.shape === 'round' ? '50%' : '2px'
                                }}
                            />
                        ) : (
                            <>
                                {/* Table Border/Content with Status Background */}
                                <div
                                    className="relative w-full h-full border-2 flex flex-col items-center justify-center shadow-sm transition-colors duration-300"
                                    style={{
                                        backgroundColor: getStatusColor(table.status),
                                        borderColor: getStatusColor(table.status),
                                        borderRadius: table.shape === 'round' ? '50%' : '6px'
                                    }}
                                >
                                    {/* Table Name - Scale font based on size */}
                                    <span 
                                        className="font-bold truncate max-w-full px-1 select-none pointer-events-none text-black drop-shadow-[0_1px_1px_rgba(255,255,255,0.5)]"
                                        style={{
                                            fontSize: gridSize < 35 ? '10px' : '12px'
                                        }}
                                    >
                                        {table.name}
                                    </span>

                                    {/* Capacity or Status Icon - Only show if cell is big enough */}
                                    {gridSize >= 35 && (
                                        <div className="flex items-center text-[10px] mt-0.5 select-none pointer-events-none text-black/90">
                                            {table.status === 'FREE' ? (
                                                <>
                                                    <Users size={10} className="mr-0.5" />
                                                    <span>{table.capacity}</span>
                                                </>
                                            ) : (
                                                <UtensilsCrossed size={10} />
                                            )}
                                        </div>
                                    )}

                                    {/* Active Order Badge - Show on hover */}
                                    {table.current_order && (
                                        <div 
                                            className="absolute bg-blue-600 text-white rounded-full shadow-sm font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-200 select-none pointer-events-none"
                                            style={{
                                                top: gridSize < 28 ? '-4px' : '-8px',
                                                right: gridSize < 28 ? '-4px' : '-8px',
                                                fontSize: gridSize < 28 ? '7px' : '9px',
                                                padding: gridSize < 28 ? '1px 4px' : '2px 6px',
                                            }}
                                        >
                                            ${table.current_order.total_amount.toFixed(0)}
                                        </div>
                                    )}
                                </div>

                                {/* Resize Handle - Bottom Right Corner - Always present but only visible when selected */}
                                {!readOnly && (
                                    <div
                                        onMouseDown={(e) => isSelected ? handleResizeStart(e, table) : undefined}
                                        className={`absolute bottom-0 right-0 w-5 h-5 bg-indigo-500/90 backdrop-blur-sm rounded-tl-lg flex items-center justify-center cursor-nwse-resize hover:bg-indigo-600 transition-all duration-150 shadow-lg z-20 group/resize ${
                                            isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
                                        }`}
                                        style={{
                                            borderBottomRightRadius: table.shape === 'round' ? '50%' : '6px'
                                        }}
                                        title="Arrastra para cambiar tamaño"
                                    >
                                        <Maximize2 size={14} className="text-white rotate-90" strokeWidth={3} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })}
            </div>
        </div>
    );
};

export default TableMap;
