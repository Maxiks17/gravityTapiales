import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Trash2, Search, Calculator, Pencil, ChevronDown, ChevronUp } from 'lucide-react';
import { stockService, type Stock } from '../../services/stockService';

export interface CompositionItem {
    id?: string;
    stock_id: string;
    stock?: Stock;
    factor: number;
}

interface CompositionEditorProps {
    items: CompositionItem[];
    onChange: (items: CompositionItem[]) => void;
    disabled?: boolean;
}

// ── Conversion units system ──────────────────────────────────────────

type UnitCategory = 'weight' | 'volume' | 'units';

interface ConversionUnit {
    label: string;
    abbr: string;
    /** Maps to unit_types.code in DB */
    code: string;
    category: UnitCategory;
    /** Factor to convert TO the base unit of this category (base: g for weight, ml for volume) */
    toBase: number;
}

const CONVERSION_UNITS: ConversionUnit[] = [
    // Weight (base: gramo)
    { label: 'Kilogramo', abbr: 'kg', code: 'kg', category: 'weight', toBase: 1000 },
    { label: 'Gramo', abbr: 'g', code: 'gr', category: 'weight', toBase: 1 },
    // Volume (base: mililitro)
    { label: 'Litro', abbr: 'L', code: 'liter', category: 'volume', toBase: 1000 },
    { label: 'Mililitro', abbr: 'mL', code: 'ml', category: 'volume', toBase: 1 },
    // Units (no conversion)
    { label: 'Unidad', abbr: 'u', code: 'unit', category: 'units', toBase: 1 },
];

function findConversionUnit(stockUnitCode: string | undefined): ConversionUnit | null {
    if (!stockUnitCode) return null;
    return CONVERSION_UNITS.find(u => u.code === stockUnitCode) ?? null;
}

function getCompatibleUnits(unit: ConversionUnit): ConversionUnit[] {
    return CONVERSION_UNITS.filter(u => u.category === unit.category);
}

interface QuickPreset {
    label: string;
    sellUnitCode: string;
    quantity: number;
}

function getQuickPresets(stockUnitCode: string): QuickPreset[] {
    switch (stockUnitCode) {
        case 'kg':
            return [
                { label: 'Por gramo', sellUnitCode: 'gr', quantity: 1 },
                { label: '100g', sellUnitCode: 'gr', quantity: 100 },
                { label: '250g', sellUnitCode: 'gr', quantity: 250 },
                { label: '500g', sellUnitCode: 'gr', quantity: 500 },
                { label: 'Por kilo', sellUnitCode: 'kg', quantity: 1 },
            ];
        case 'gr':
            return [
                { label: 'Por gramo', sellUnitCode: 'gr', quantity: 1 },
                { label: '100g', sellUnitCode: 'gr', quantity: 100 },
                { label: '250g', sellUnitCode: 'gr', quantity: 250 },
            ];
        case 'liter':
            return [
                { label: 'Por mL', sellUnitCode: 'ml', quantity: 1 },
                { label: '250mL', sellUnitCode: 'ml', quantity: 250 },
                { label: '500mL', sellUnitCode: 'ml', quantity: 500 },
                { label: 'Por litro', sellUnitCode: 'liter', quantity: 1 },
            ];
        case 'ml':
            return [
                { label: 'Por mL', sellUnitCode: 'ml', quantity: 1 },
                { label: '250mL', sellUnitCode: 'ml', quantity: 250 },
            ];
        default:
            return [];
    }
}

// ── Conversion Helper Row Component ──────────────────────────────────

interface ConversionHelperProps {
    item: CompositionItem;
    index: number;
    onFactorChange: (index: number, factor: number) => void;
    disabled?: boolean;
}

/**
 * Given an existing factor and the stock unit, try to reverse-engineer
 * the best sell-unit + quantity that produces that factor.
 * E.g. factor=0.001, stockUnit=kg → sellUnit=gr, qty=1  (1g = 0.001kg)
 * E.g. factor=0.25, stockUnit=kg  → sellUnit=gr, qty=250 (250g = 0.25kg)
 */
function reverseEngineerFactor(
    factor: number,
    stockUnit: ConversionUnit,
    compatibleUnits: ConversionUnit[]
): { sellUnitCode: string; sellQuantity: number } {
    // Try each compatible unit and see which gives the cleanest sellQuantity
    let bestMatch = { sellUnitCode: stockUnit.code, sellQuantity: factor };

    for (const candidate of compatibleUnits) {
        // factor = (sellQuantity * candidate.toBase) / stockUnit.toBase
        // → sellQuantity = factor * stockUnit.toBase / candidate.toBase
        const qty = (factor * stockUnit.toBase) / candidate.toBase;

        // Prefer results where qty is a clean number (integer or simple decimal)
        // and qty >= 1 to be more intuitive
        if (qty > 0) {
            const isClean = Math.abs(qty - Math.round(qty)) < 0.0001;
            const currentIsClean = Math.abs(bestMatch.sellQuantity - Math.round(bestMatch.sellQuantity)) < 0.0001;

            // Prefer: clean integer qty >= 1 > clean decimal > any
            if (
                (isClean && qty >= 1 && (!currentIsClean || bestMatch.sellQuantity < 1)) ||
                (isClean && qty >= 1 && currentIsClean && bestMatch.sellQuantity >= 1 && qty <= bestMatch.sellQuantity)
            ) {
                bestMatch = { sellUnitCode: candidate.code, sellQuantity: Math.round(qty * 10000) / 10000 };
            }
        }
    }

    return bestMatch;
}

const ConversionHelper: React.FC<ConversionHelperProps> = ({ item, index, onFactorChange, disabled }) => {
    const stockUnitCode = item.stock?.unit_type?.code;
    const stockUnit = findConversionUnit(stockUnitCode);
    const compatibleUnits = useMemo(() => stockUnit ? getCompatibleUnits(stockUnit) : [], [stockUnit]);
    const quickPresets = useMemo(() => stockUnitCode ? getQuickPresets(stockUnitCode) : [], [stockUnitCode]);

    // Reverse-engineer the initial factor to determine sell unit + quantity
    const initialState = useMemo(() => {
        if (!stockUnit || compatibleUnits.length <= 1) {
            return { sellUnitCode: stockUnitCode ?? '', sellQuantity: 1 };
        }
        return reverseEngineerFactor(item.factor, stockUnit, compatibleUnits);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- only on mount

    const [isExpanded, setIsExpanded] = useState(false);
    const [useManual, setUseManual] = useState(false);
    const [sellUnitCode, setSellUnitCode] = useState(initialState.sellUnitCode);
    const [sellQuantity, setSellQuantity] = useState(initialState.sellQuantity);
    const isInitialMount = useRef(true);

    const sellUnit = findConversionUnit(sellUnitCode);

    // Compute factor from sell unit + quantity
    const computedFactor = useMemo(() => {
        if (!stockUnit || !sellUnit) return 1;
        // factor = how many stock-units are consumed per sale-unit
        // e.g. stock=kg, sell=g, qty=1 → (1 * 1) / 1000 = 0.001
        const raw = (sellQuantity * sellUnit.toBase) / stockUnit.toBase;
        return Math.round(raw * 10000) / 10000; // avoid floating point noise
    }, [stockUnit, sellUnit, sellQuantity]);

    // Sync factor to parent when computed values change (only in auto mode)
    // Skip on initial mount to avoid overwriting the existing factor from DB
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (!useManual && stockUnit && sellUnit) {
            onFactorChange(index, computedFactor);
        }
    }, [computedFactor, useManual, stockUnit, sellUnit]); // eslint-disable-line react-hooks/exhaustive-deps

    const handlePresetClick = useCallback((preset: QuickPreset) => {
        setSellUnitCode(preset.sellUnitCode);
        setSellQuantity(preset.quantity);
        setUseManual(false);
    }, []);

    // If stock has no recognized unit, show simple manual input
    if (!stockUnit || compatibleUnits.length <= 1) {
        return (
            <div className="flex items-center gap-2">
                <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    value={item.factor}
                    onChange={(e) => onFactorChange(index, parseFloat(e.target.value) || 0)}
                    disabled={disabled}
                    className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.stock?.unit_type?.name ?? 'unidades'}
                </span>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {/* Collapsed summary + toggle */}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsExpanded(!isExpanded)}
                    disabled={disabled}
                    className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                >
                    <Calculator className="h-3.5 w-3.5" />
                    {isExpanded ? 'Cerrar conversor' : 'Abrir conversor'}
                    {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                    {useManual
                        ? `Factor: ${item.factor}`
                        : `${sellQuantity} ${sellUnit?.abbr ?? ''} → ${computedFactor} ${stockUnit.abbr}`
                    }
                </span>
            </div>

            {/* Expanded converter */}
            {isExpanded && (
                <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                    {!useManual ? (
                        <>
                            {/* Quick presets */}
                            {quickPresets.length > 0 && (
                                <div>
                                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1.5">Atajos rápidos</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {quickPresets.map((preset) => {
                                            const isActive = sellUnitCode === preset.sellUnitCode && sellQuantity === preset.quantity;
                                            return (
                                                <button
                                                    key={preset.label}
                                                    type="button"
                                                    onClick={() => handlePresetClick(preset)}
                                                    disabled={disabled}
                                                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                                                        isActive
                                                            ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 font-semibold'
                                                            : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 dark:hover:border-blue-500'
                                                    }`}
                                                >
                                                    {preset.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Custom conversion */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-gray-600 dark:text-gray-400">Cada venta consume</span>
                                <input
                                    type="number"
                                    min={0.001}
                                    step="any"
                                    value={sellQuantity}
                                    onChange={(e) => setSellQuantity(parseFloat(e.target.value) || 0)}
                                    disabled={disabled}
                                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                                />
                                <select
                                    value={sellUnitCode}
                                    onChange={(e) => setSellUnitCode(e.target.value)}
                                    disabled={disabled}
                                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                                >
                                    {compatibleUnits.map(u => (
                                        <option key={u.code} value={u.code}>{u.label} ({u.abbr})</option>
                                    ))}
                                </select>
                                <span className="text-xs text-gray-600 dark:text-gray-400">de {item.stock?.name}</span>
                            </div>

                            {/* Result preview */}
                            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-xs text-green-800 dark:text-green-300">
                                        <strong>1 unidad vendida</strong> = {sellQuantity} {sellUnit?.abbr}
                                    </span>
                                    <span className="text-xs text-green-600 dark:text-green-400">
                                        Descuenta <strong>{computedFactor}</strong> {stockUnit.abbr} del stock
                                    </span>
                                </div>
                                {stockUnit.code !== sellUnit?.code && (
                                    <p className="text-[11px] text-green-600 dark:text-green-500 mt-1">
                                        Equivalencia: {sellQuantity} {sellUnit?.abbr} = {computedFactor} {stockUnit.abbr}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : (
                        /* Manual factor input */
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-600 dark:text-gray-400">Factor manual:</label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                value={item.factor}
                                onChange={(e) => onFactorChange(index, parseFloat(e.target.value) || 0)}
                                disabled={disabled}
                                className="w-28 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                            />
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                {stockUnit.abbr} por cada venta
                            </span>
                        </div>
                    )}

                    {/* Toggle manual/auto */}
                    <button
                        type="button"
                        onClick={() => setUseManual(!useManual)}
                        disabled={disabled}
                        className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                        {useManual ? (
                            <><Calculator className="h-3 w-3" /> Usar conversor automático</>
                        ) : (
                            <><Pencil className="h-3 w-3" /> Ingresar factor manualmente</>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Main CompositionEditor ───────────────────────────────────────────

const CompositionEditor: React.FC<CompositionEditorProps> = ({ items, onChange, disabled }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Stock[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchStocks = async () => {
            if (searchQuery.length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const results = await stockService.search(searchQuery);
                const existingIds = items.map(i => i.stock_id);
                setSearchResults(results.filter(s => !existingIds.includes(s.id)));
            } catch (error) {
                console.error('Error searching stocks:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(searchStocks, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, items]);

    const handleAddItem = (stock: Stock) => {
        const newItem: CompositionItem = {
            stock_id: stock.id,
            stock: stock,
            factor: 1,
        };
        onChange([...items, newItem]);
        setSearchQuery('');
        setSearchResults([]);
        setShowDropdown(false);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        onChange(newItems);
    };

    const handleFactorChange = (index: number, factor: number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], factor };
        onChange(newItems);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Define los insumos que se consumen al vender este producto</span>
            </div>

            {/* Search Input */}
            <div ref={searchRef} className="relative">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar insumo para agregar..."
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        disabled={disabled}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {showDropdown && (searchResults.length > 0 || isSearching) && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
                        {isSearching ? (
                            <div className="px-4 py-3 text-sm text-gray-500">Buscando...</div>
                        ) : (
                            searchResults.map((stock) => (
                                <button
                                    key={stock.id}
                                    type="button"
                                    onClick={() => handleAddItem(stock)}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex justify-between items-center"
                                >
                                    <span className="text-gray-900 dark:text-gray-100">{stock.name}</span>
                                    <span className="text-sm text-gray-500">
                                        {stock.quantity} {stock.unit_type?.name || ''}
                                    </span>
                                </button>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Composition Items */}
            {items.length > 0 && (
                <div className="space-y-2">
                    {items.map((item, index) => (
                        <div
                            key={item.stock_id}
                            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                        >
                            {/* Item header row */}
                            <div className="flex items-center gap-3 px-3 py-2.5 bg-white dark:bg-gray-900">
                                <div className="flex-1 min-w-0">
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {item.stock?.name || 'Cargando...'}
                                    </span>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                            Stock: {item.stock?.quantity?.toFixed(2) ?? '-'} {item.stock?.unit_type?.name ?? ''}
                                        </span>
                                        <span className="text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                                            Factor: {item.factor}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveItem(index)}
                                    disabled={disabled}
                                    className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 shrink-0"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>

                            {/* Conversion helper */}
                            <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                                <ConversionHelper
                                    item={item}
                                    index={index}
                                    onFactorChange={handleFactorChange}
                                    disabled={disabled}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {items.length === 0 && (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
                    No hay insumos agregados. Busca un insumo arriba para agregarlo.
                </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400">
                💡 Usá el conversor para calcular el factor automáticamente. Ej: si cargaste almendras por kg y querés vender por gramo, abrí el conversor y elegí "Por gramo".
            </p>
        </div>
    );
};

export default CompositionEditor;
