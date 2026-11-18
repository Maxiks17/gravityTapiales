import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, FileDown, FileText, History, AlertTriangle } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { stockService, type Stock } from '../services/stockService';
import { stockMovementService, type StockMovement } from '../services/stockMovementService';
import { UNIT_TYPES_LIST } from '../constants/unitTypes';
import { Button } from '../components/ui/Button';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '../components/ui/shadcn-table';
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
} from '../components/ui/shadcn-pagination';
import { useServerPagination } from '../hooks/useServerPagination';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import SearchBar from '../components/ui/SearchBar';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import styles from '../styles/page-layout.module.css';

const Inventory: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [isMovementsModalOpen, setIsMovementsModalOpen] = useState(false);
    const [currentStock, setCurrentStock] = useState<Partial<Stock>>({});
    const [adjustmentData, setAdjustmentData] = useState({ newQuantity: '', reason: '' });
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const {
        data: stocks,
        loading,
        currentPage,
        totalPages,
        goToPage,
        nextPage,
        previousPage,
        hasNextPage,
        hasPreviousPage,
        refresh,
    } = useServerPagination({
        fetchFunction: (page, pageSize) => stockService.getPaginated(page, pageSize, debouncedSearchTerm),
        pageSize: 20,
        dependencies: [debouncedSearchTerm],
    });

    const getPageNumbers = () => {
        if (totalPages <= 7) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        const pages: number[] = [];
        pages.push(1);

        let startPage: number;
        let endPage: number;

        if (currentPage <= 3) {
            startPage = 2;
            endPage = 5;
        } else if (currentPage >= totalPages - 2) {
            startPage = totalPages - 4;
            endPage = totalPages - 1;
        } else {
            startPage = currentPage - 1;
            endPage = currentPage + 1;
        }

        if (startPage > 2) {
            pages.push(-1);
        }

        for (let i = startPage; i <= endPage; i++) {
            if (i > 1 && i < totalPages) {
                pages.push(i);
            }
        }

        if (endPage < totalPages - 1) {
            pages.push(-1);
        }

        if (totalPages > 1) {
            pages.push(totalPages);
        }

        return pages;
    };

    const handleExportAll = async () => {
        return await stockService.getAll();
    };

    const handleOpenModal = (stock?: Stock) => {
        if (stock) {
            setCurrentStock(stock);
        } else {
            setCurrentStock({
                is_active: true,
                quantity: 0,
                min_stock_level: 0,
                cost_price: 0,
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentStock({});
    };

    const handleOpenAdjustModal = (stock: Stock) => {
        setCurrentStock(stock);
        setAdjustmentData({ newQuantity: stock.quantity.toString(), reason: '' });
        setIsAdjustModalOpen(true);
    };

    const handleCloseAdjustModal = () => {
        setIsAdjustModalOpen(false);
        setCurrentStock({});
        setAdjustmentData({ newQuantity: '', reason: '' });
    };

    const handleOpenMovementsModal = async (stock: Stock) => {
        setCurrentStock(stock);
        setMovementsLoading(true);
        setIsMovementsModalOpen(true);
        try {
            const result = await stockMovementService.getByStock(stock.id, 1, 50);
            setMovements(result.data);
        } catch (error) {
            console.error('Error loading movements:', error);
        } finally {
            setMovementsLoading(false);
        }
    };

    const handleCloseMovementsModal = () => {
        setIsMovementsModalOpen(false);
        setCurrentStock({});
        setMovements([]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (currentStock.id) {
                await stockService.update(currentStock.id, currentStock);
            } else {
                await stockService.create(currentStock as any);
            }
            handleCloseModal();
            refresh();
        } catch (error) {
            console.error('Error saving stock:', error);
            alert('Error al guardar el insumo');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustmentData.reason.trim()) {
            alert('Debe ingresar un motivo para el ajuste');
            return;
        }
        setIsSaving(true);
        try {
            await stockService.adjustStock(
                currentStock.id!,
                parseFloat(adjustmentData.newQuantity),
                adjustmentData.reason
            );
            handleCloseAdjustModal();
            refresh();
        } catch (error) {
            console.error('Error adjusting stock:', error);
            alert('Error al ajustar el stock');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const { canDelete, reason, linkedProducts, linkedSimpleProduct } = await stockService.canDelete(id);

            if (!canDelete) {
                let message = reason || 'No se puede eliminar este ítem.';
                if (linkedProducts && linkedProducts.length > 0) {
                    message += `\n\nProductos compuestos vinculados:\n- ${linkedProducts.join('\n- ')}`;
                }
                alert(message);
                return;
            }

            let confirmMessage = '¿Está seguro de eliminar este insumo?';
            if (linkedSimpleProduct) {
                confirmMessage = `Este insumo está vinculado al producto "${linkedSimpleProduct.name}".\n\n¿Desea eliminar tanto el insumo como el producto asociado?`;
            }

            if (window.confirm(confirmMessage)) {
                await stockService.deleteWithProduct(id);
                refresh();
            }
        } catch (error) {
            console.error('Error deleting stock:', error);
            alert('Error al eliminar el insumo');
        }
    };

    const isLowStock = (stock: Stock) => stock.quantity <= stock.min_stock_level;

    const formatQuantity = (quantity: number, unitType?: Stock['unit_type']) => {
        if (unitType?.allows_decimals) {
            return quantity.toFixed(4).replace(/\.?0+$/, '');
        }
        return Math.floor(quantity).toString();
    };

    return (
        <Layout title="Inventario">
            <FadeIn>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div className={styles.headerActions}>
                            <SearchBar
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Buscar insumos..."
                            />
                            <div className={styles.exportGroup}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        const data = await handleExportAll();
                                        exportToCSV(
                                            data.map(s => ({
                                                nombre: s.name,
                                                cantidad: s.quantity,
                                                unidad: s.unit_type?.name || '-',
                                                stock_minimo: s.min_stock_level,
                                                costo: s.cost_price,
                                            })),
                                            'inventario',
                                            [
                                                { header: 'Nombre', key: 'nombre' },
                                                { header: 'Cantidad', key: 'cantidad' },
                                                { header: 'Unidad', key: 'unidad' },
                                                { header: 'Stock Mínimo', key: 'stock_minimo' },
                                                { header: 'Costo', key: 'costo' },
                                            ]
                                        );
                                    }}
                                    title="Exportar a CSV"
                                >
                                    <FileText size={18} />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                        const data = await handleExportAll();
                                        exportToPDF(
                                            data.map(s => ({
                                                nombre: s.name,
                                                cantidad: s.quantity,
                                                unidad: s.unit_type?.name || '-',
                                                stock_minimo: s.min_stock_level,
                                                costo: s.cost_price,
                                            })),
                                            'inventario',
                                            [
                                                { header: 'Nombre', key: 'nombre' },
                                                { header: 'Cantidad', key: 'cantidad' },
                                                { header: 'Unidad', key: 'unidad' },
                                                { header: 'Stock Mínimo', key: 'stock_minimo' },
                                                { header: 'Costo', key: 'costo' },
                                            ],
                                            'Listado de Inventario'
                                        );
                                    }}
                                    title="Exportar a PDF"
                                >
                                    <FileDown size={18} />
                                </Button>
                            </div>
                            <Button onClick={() => handleOpenModal()} size="sm">
                                <Plus size={18} style={{ marginRight: '0.5rem' }} />
                                Nuevo Insumo
                            </Button>
                        </div>
                    </div>

                    {loading ? (
                        <LoadingPlaceholder />
                    ) : (
                        <>
                            <div className={styles.tableWrapper}>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Nombre</TableHead>
                                            <TableHead>Cantidad</TableHead>
                                            <TableHead>Unidad</TableHead>
                                            <TableHead>Stock Mínimo</TableHead>
                                            <TableHead>Costo</TableHead>
                                            <TableHead>Acciones</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {stocks.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                                    No hay insumos registrados
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            stocks.map((stock) => (
                                                <TableRow
                                                    key={stock.id}
                                                    className={isLowStock(stock) ? 'bg-red-50 dark:bg-red-900/20' : ''}
                                                >
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            {isLowStock(stock) && (
                                                                <AlertTriangle className="h-4 w-4 text-red-500" />
                                                            )}
                                                            <span className={isLowStock(stock) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                                                {stock.name}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className={isLowStock(stock) ? 'text-red-600 dark:text-red-400 font-bold' : ''}>
                                                            {formatQuantity(stock.quantity, stock.unit_type)}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>{stock.unit_type?.name || '-'}</TableCell>
                                                    <TableCell>{formatQuantity(stock.min_stock_level, stock.unit_type)}</TableCell>
                                                    <TableCell>${stock.cost_price.toFixed(2)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenMovementsModal(stock)}
                                                                title="Ver movimientos"
                                                            >
                                                                <History className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenAdjustModal(stock)}
                                                                title="Ajustar stock"
                                                            >
                                                                <AlertTriangle className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenModal(stock)}
                                                            >
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDelete(stock.id)}
                                                                title="Eliminar"
                                                            >
                                                                <Trash2 className="h-4 w-4 text-red-500" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {totalPages > 1 && (
                                <div className="mt-4">
                                    <Pagination>
                                        <PaginationContent>
                                            <PaginationItem>
                                                <PaginationPrevious
                                                    onClick={hasPreviousPage ? previousPage : undefined}
                                                    className={!hasPreviousPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                                />
                                            </PaginationItem>
                                            {getPageNumbers().map((pageNum, idx) => (
                                                <PaginationItem key={idx}>
                                                    {pageNum === -1 ? (
                                                        <span className="px-3 py-2">...</span>
                                                    ) : (
                                                        <PaginationLink
                                                            onClick={() => goToPage(pageNum)}
                                                            isActive={currentPage === pageNum}
                                                            className="cursor-pointer"
                                                        >
                                                            {pageNum}
                                                        </PaginationLink>
                                                    )}
                                                </PaginationItem>
                                            ))}
                                            <PaginationItem>
                                                <PaginationNext
                                                    onClick={hasNextPage ? nextPage : undefined}
                                                    className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                                />
                                            </PaginationItem>
                                        </PaginationContent>
                                    </Pagination>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </FadeIn>

            {/* Modal: Create/Edit Stock */}
            <Modal isOpen={isModalOpen} onClose={handleCloseModal} title={currentStock.id ? 'Editar Insumo' : 'Nuevo Insumo'}>
                <form onSubmit={handleSave} className="space-y-4">
                    <Input
                        label="Nombre *"
                        value={currentStock.name || ''}
                        onChange={(e) => setCurrentStock({ ...currentStock, name: e.target.value })}
                        required
                    />
                    <Input
                        label="Descripción"
                        value={currentStock.description || ''}
                        onChange={(e) => setCurrentStock({ ...currentStock, description: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Cantidad"
                            type="number"
                            step="0.0001"
                            value={currentStock.quantity || 0}
                            onChange={(e) => setCurrentStock({ ...currentStock, quantity: parseFloat(e.target.value) || 0 })}
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Unidad
                            </label>
                            <select
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                                value={currentStock.unit_type_code || ''}
                                onChange={(e) => setCurrentStock({ ...currentStock, unit_type_code: e.target.value || undefined })}
                            >
                                <option value="">Seleccionar...</option>
                                {UNIT_TYPES_LIST.map((ut) => (
                                    <option key={ut.code} value={ut.code}>{ut.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Stock Mínimo"
                            type="number"
                            step="0.0001"
                            value={currentStock.min_stock_level || 0}
                            onChange={(e) => setCurrentStock({ ...currentStock, min_stock_level: parseFloat(e.target.value) || 0 })}
                        />
                        <Input
                            label="Costo"
                            type="number"
                            step="0.01"
                            value={currentStock.cost_price || 0}
                            onChange={(e) => setCurrentStock({ ...currentStock, cost_price: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseModal}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Guardando...' : 'Guardar'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Adjust Stock */}
            <Modal isOpen={isAdjustModalOpen} onClose={handleCloseAdjustModal} title="Ajustar Stock">
                <form onSubmit={handleAdjust} className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                        Insumo: <strong>{currentStock.name}</strong>
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                        Cantidad actual: <strong>{currentStock.quantity}</strong>
                    </p>
                    <Input
                        label="Nueva Cantidad *"
                        type="number"
                        step="0.0001"
                        value={adjustmentData.newQuantity}
                        onChange={(e) => setAdjustmentData({ ...adjustmentData, newQuantity: e.target.value })}
                        required
                    />
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Motivo del ajuste *
                        </label>
                        <textarea
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            rows={3}
                            value={adjustmentData.reason}
                            onChange={(e) => setAdjustmentData({ ...adjustmentData, reason: e.target.value })}
                            placeholder="Ej: Conteo físico, merma, ajuste por inventario..."
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="secondary" onClick={handleCloseAdjustModal}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? 'Ajustando...' : 'Confirmar Ajuste'}
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Modal: Stock Movements */}
            <Modal isOpen={isMovementsModalOpen} onClose={handleCloseMovementsModal} title={`Movimientos: ${currentStock.name || ''}`}>
                {movementsLoading ? (
                    <div className="py-8 text-center text-gray-500">Cargando movimientos...</div>
                ) : movements.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">No hay movimientos registrados</div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-left">Fecha</th>
                                    <th className="px-3 py-2 text-left">Tipo</th>
                                    <th className="px-3 py-2 text-right">Cantidad</th>
                                    <th className="px-3 py-2 text-left">Motivo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map((mov) => (
                                    <tr key={mov.id} className="border-t dark:border-gray-700">
                                        <td className="px-3 py-2">
                                            {new Date(mov.created_at).toLocaleString('es-AR', {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-3 py-2">
                                            {stockMovementService.getMovementTypeLabel(mov.movement_type)}
                                        </td>
                                        <td className={`px-3 py-2 text-right font-mono ${mov.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {mov.quantity >= 0 ? '+' : ''}{mov.quantity}
                                        </td>
                                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[200px]" title={mov.reason || ''}>
                                            {mov.reason || '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                <div className="flex justify-end pt-4">
                    <Button variant="secondary" onClick={handleCloseMovementsModal}>
                        Cerrar
                    </Button>
                </div>
            </Modal>
        </Layout>
    );
};

export default Inventory;
