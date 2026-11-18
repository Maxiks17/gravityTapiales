import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Edit3, Save, Trash2, Settings, BoxSelect, Circle, X, Users } from 'lucide-react';
import { useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { tableService } from '../services/tableService';
import { areaService } from '../services/areaService';
import { staffService } from '../services/staffService';
import type { Table, Area, Staff } from '../types/operationMode';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { useToast } from '../context/ToastContext';
import { useTenant } from '../context/TenantContext';
import TableMap from '../components/tables/TableMap';


const Tables: React.FC = () => {
    const navigate = useNavigate();
    const navigationContext = React.useContext(UNSAFE_NavigationContext);
    const { showToast } = useToast();
    const { currentTenant } = useTenant();

    // Data State
    const [areas, setAreas] = useState<Area[]>([]);
    const [tables, setTables] = useState<Table[]>([]);
    const [waiters, setWaiters] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);

    // UI State
    const [mode, setMode] = useState<'view' | 'edit'>('view');
    const [activeAreaId, setActiveAreaId] = useState<string>('');

    // Editor State
    const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [isCreatingTable, setIsCreatingTable] = useState(false);
    const [tablesToDelete, setTablesToDelete] = useState<string[]>([]);

    // Modals
    const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
    const [areaFormData, setAreaFormData] = useState<{ name: string }>({ name: '' });
    const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false);
    const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
    const [tableToOpen, setTableToOpen] = useState<Table | null>(null);
    const [isTableEditModalOpen, setIsTableEditModalOpen] = useState(false);

    // Values
    const GRID_COLUMNS = 23;  // Fixed grid columns
    const GRID_ROWS = 12;     // Fixed grid rows

    // Clear selections when switching to view mode
    useEffect(() => {
        if (mode === 'view') {
            setSelectedTableId(null);
        }
    }, [mode]);

    // Prevenir recarga o cierre de página con cambios sin guardar
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (unsavedChanges && mode === 'edit') {
                e.preventDefault();
                e.returnValue = '';
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [unsavedChanges, mode]);

    // Bloquear navegación dentro de la app con cambios sin guardar
    useEffect(() => {
        if (!navigationContext?.navigator) return;

        const { navigator } = navigationContext;
        const originalPush = navigator.push;
        const originalReplace = navigator.replace;

        if (unsavedChanges && mode === 'edit') {
            navigator.push = (...args: any[]) => {
                if (window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y salir?')) {
                    (originalPush as any)(...args);
                }
            };

            navigator.replace = (...args: any[]) => {
                if (window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y salir?')) {
                    (originalReplace as any)(...args);
                }
            };
        }

        return () => {
            navigator.push = originalPush;
            navigator.replace = originalReplace;
        };
    }, [unsavedChanges, mode, navigationContext]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        loadWaiters();
    }, [currentTenant]);

    const loadData = async () => {
        try {
            setLoading(true);
            const [areasData, tablesData] = await Promise.all([
                areaService.getAll(),
                tableService.getAllWithOrders()
            ]);

            setAreas(areasData);
            setTables(tablesData);

            // Set initial active area (only top-level areas)
            const topLevelAreas = areasData.filter(a => !a.parent_id);
            if (topLevelAreas.length > 0 && !activeAreaId) {
                setActiveAreaId(topLevelAreas[0].id);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Error al cargar datos', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadTables = async () => {
        try {
            const tablesData = await tableService.getAllWithOrders();
            setTables(tablesData);
        } catch (error) {
            console.error('Error loading tables:', error);
            showToast('Error al cargar mesas', 'error');
        }
    };

    const loadWaiters = async () => {
        if (!currentTenant) return;
        try {
            const waitersData = await staffService.getActive(currentTenant.id, 'waiter');
            setWaiters(waitersData);
        } catch (error) {
            console.error('Error loading waiters:', error);
        }
    };

    // --- Derived State ---

    // All areas (no hierarchy - all are top-level)
    const allAreas = useMemo(() => {
        return areas.filter(a => !a.parent_id);
    }, [areas]);

    // Tables for the currently active area
    const currentTables = useMemo(() => {
        if (!activeAreaId) return [];
        return tables.filter(t => t.area_id === activeAreaId);
    }, [tables, activeAreaId]);



    // --- Actions ---

    const handleTableClick = (table: Table) => {
        if (mode === 'edit') {
            // Solo seleccionar la mesa
            setSelectedTableId(table.id);
        } else {
            // View mode action (Open/Navigate)
            if (table.status === 'FREE') {
                // Show waiter selection modal
                setTableToOpen(table);
                setSelectedWaiterId('');
                setIsWaiterModalOpen(true);
            } else {
                navigate(`/pos?table=${table.id}&order=${table.current_order?.id}`);
            }
        }
    };

    const handleTableDoubleClick = (table: Table) => {
        if (mode === 'edit') {
            setSelectedTableId(table.id);
            setIsTableEditModalOpen(true);
        }
    };

    const confirmOpenTable = async () => {
        if (!tableToOpen) return;

        try {
            const tableId = await tableService.openTable(tableToOpen.id);
            const waiterName = selectedWaiterId 
                ? staffService.getFullName(waiters.find(w => w.id === selectedWaiterId) || null)
                : 'Sin mozo asignado';
            showToast(`Mesa ${tableToOpen.name} preparada - ${waiterName}`, 'success');
            setIsWaiterModalOpen(false);
            // Navigate to POS with tableId and waiterId (no orderId yet - will be created when first item is added)
            navigate(`/pos?table=${tableId}&waiter=${selectedWaiterId || ''}`);
        } catch (error) {
            console.error('Error opening table:', error);
            showToast('Error al abrir mesa', 'error');
        }
    };



    const handleTableMove = (tableId: string, x: number, y: number) => {
        if (mode !== 'edit') return;
        setTables(prev => prev.map(t =>
            t.id === tableId ? { ...t, position_x: x, position_y: y } : t
        ));
        setUnsavedChanges(true);
    };

    const handleTableResize = (tableId: string, width: number, height: number) => {
        if (mode !== 'edit') return;
        setTables(prev => prev.map(t =>
            t.id === tableId ? { ...t, width, height } : t
        ));
        setUnsavedChanges(true);
    };

    const handleSaveLayout = async () => {
        try {
            // Eliminar mesas marcadas para eliminación
            if (tablesToDelete.length > 0) {
                await Promise.all(
                    tablesToDelete.map(id => tableService.delete(id))
                );
            }

            // Separar mesas nuevas (con ID temporal) y existentes
            const newTables = currentTables.filter(t => t.id.startsWith('temp-'));
            const existingTables = currentTables.filter(t => !t.id.startsWith('temp-'));

            // Crear las mesas nuevas en la BD
            const createdTables = await Promise.all(
                newTables.map(t => tableService.create({
                    name: t.name,
                    area_id: t.area_id,
                    capacity: t.capacity,
                    position_x: t.position_x,
                    position_y: t.position_y,
                    width: t.width,
                    height: t.height,
                    shape: t.shape,
                    rotation: t.rotation
                }))
            );

            // Actualizar las mesas existentes
            const updates = existingTables.map(t => tableService.update(t.id, {
                name: t.name,
                capacity: t.capacity,
                position_x: t.position_x,
                position_y: t.position_y,
                width: t.width,
                height: t.height,
                rotation: t.rotation,
                shape: t.shape,
            }));
            await Promise.all(updates);

            // Reemplazar mesas temporales con las creadas en BD
            setTables(prev => {
                let updated = [...prev];
                newTables.forEach((tempTable, index) => {
                    const tempIndex = updated.findIndex(t => t.id === tempTable.id);
                    if (tempIndex !== -1) {
                        updated[tempIndex] = createdTables[index];
                    }
                });
                return updated;
            });

            // Actualizar selectedTableId si era temporal
            if (selectedTableId?.startsWith('temp-')) {
                const tempIndex = newTables.findIndex(t => t.id === selectedTableId);
                if (tempIndex !== -1 && createdTables[tempIndex]) {
                    setSelectedTableId(createdTables[tempIndex].id);
                }
            }

            showToast('Diseño guardado exitosamente', 'success');
            setUnsavedChanges(false);
            setTablesToDelete([]);
            setMode('view');
        } catch (error) {
            console.error('Error saving layout:', error);
            showToast('Error al guardar diseño', 'error');
        }
    };

    const handleAddTable = async () => {
        if (!activeAreaId) {
            showToast('Debes seleccionar un área para agregar mesas', 'error');
            return;
        }

        if (isCreatingTable) return; // Prevenir clicks múltiples

        try {
            setIsCreatingTable(true);
            
            const existingNames = currentTables.map(t => t.name);
            let nextNum = 1;
            while (existingNames.includes(`${nextNum}`)) nextNum++;

            // Crear mesa localmente con ID temporal
            const tempId = `temp-${Date.now()}-${Math.random()}`;
            const newTable: Table = {
                id: tempId,
                name: `${nextNum}`,
                area_id: activeAreaId,
                capacity: 4,
                position_x: 1,
                position_y: 1,
                width: 1,
                height: 1,
                shape: 'rectangle',
                status: 'FREE',
                rotation: 0,
                tenant_id: currentTenant?.id || '',
                is_active: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            setTables(prevTables => [...prevTables, newTable]);
            setSelectedTableId(newTable.id);
            setUnsavedChanges(true);
            showToast('Mesa agregada (presiona Guardar para confirmar)', 'success');
        } catch (error) {
            console.error('Error creating table:', error);
            showToast('Error al crear mesa', 'error');
        } finally {
            setIsCreatingTable(false);
        }
    };

    const handleDeleteTable = async () => {
        if (!selectedTableId) return;

        const table = tables.find(t => t.id === selectedTableId);
        if (table?.status !== 'FREE') {
            showToast('No se puede eliminar una mesa ocupada', 'error');
            return;
        }

        if (window.confirm('¿Eliminar esta mesa?')) {
            // Si la mesa existe en BD (no es temporal), agregarla a la lista de eliminación
            if (!selectedTableId.startsWith('temp-')) {
                setTablesToDelete(prev => [...prev, selectedTableId]);
            }
            
            // Remover del estado local
            setTables(prev => prev.filter(t => t.id !== selectedTableId));
            setSelectedTableId(null);
            setIsTableEditModalOpen(false);
            setUnsavedChanges(true);
            showToast('Mesa marcada para eliminar (presiona Guardar para confirmar)', 'success');
        }
    };

    const handleUpdateTableProp = (prop: string, value: any) => {
        if (!selectedTableId) return;
        setTables(prev => prev.map(t =>
            t.id === selectedTableId ? { ...t, [prop]: value } : t
        ));
        setUnsavedChanges(true);
    };

    const handleCreateArea = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const newArea = await areaService.create({ 
                name: areaFormData.name
            });
            
            setAreas([...areas, newArea]);
            setActiveAreaId(newArea.id);
            setIsAreaModalOpen(false);
            setAreaFormData({ name: '' });
            showToast('Área creada', 'success');
        } catch (error) {
            console.error('Error creating area:', error);
            showToast('Error al crear área', 'error');
        }
    };

    const handleDeleteArea = async () => {
        if (!activeAreaId) return;

        const areaTables = tables.filter(t => t.area_id === activeAreaId);
        if (areaTables.length > 0) {
            if (!window.confirm(`Esta área tiene ${areaTables.length} mesas. Se eliminarán todas. ¿Continuar?`)) return;
        } else {
            if (!window.confirm('¿Eliminar esta área?')) return;
        }

        try {
            await areaService.delete(activeAreaId);
            setAreas(prev => prev.filter(a => a.id !== activeAreaId));
            
            // Select another area if available
            const remainingAreas = areas.filter(a => a.id !== activeAreaId && !a.parent_id);
            if (remainingAreas.length > 0) {
                setActiveAreaId(remainingAreas[0].id);
            } else {
                setActiveAreaId('');
            }
            
            showToast('Área eliminada', 'success');
        } catch (error) {
            console.error('Error deleting area:', error);
            showToast('Error al eliminar área', 'error');
        }
    };

    if (loading) {
        return (
            <Layout title="Mesas">
                <LoadingPlaceholder />
            </Layout>
        );
    }

    const selectedTable = tables.find(t => t.id === selectedTableId);
    const currentArea = allAreas.find(a => a.id === activeAreaId);

    return (
        <Layout title={currentArea ? `Mesas - ${currentArea.name}` : "Mesas"}>
            <FadeIn>
                <div className="flex flex-col h-[calc(100vh-120px)] min-h-[400px] gap-2">
                    {/* Top Bar: Area Tabs */}
                    <div className="flex items-center gap-1.5 bg-card p-1.5 rounded-lg shadow-sm border border-border overflow-x-auto shrink-0">
                        {/* Area Tabs */}
                        {allAreas.map(area => (
                            <button
                                key={area.id}
                                onClick={async () => {
                                    if (unsavedChanges && mode === 'edit') {
                                        if (!window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos y cambiar de área?')) {
                                            return;
                                        }
                                        // Recargar mesas para descartar cambios locales
                                        await loadTables();
                                    }
                                    setActiveAreaId(area.id);
                                    setMode('view');
                                    setSelectedTableId(null);
                                    setUnsavedChanges(false);
                                }}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                                    activeAreaId === area.id
                                        ? 'bg-primary text-primary-foreground shadow-sm'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                                }`}
                            >
                                {area.name}
                            </button>
                        ))}
                        
                        <button
                            onClick={() => setIsAreaModalOpen(true)}
                            className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors shrink-0"
                            title="Nueva Área"
                        >
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* Main Content */}
                    {allAreas.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center bg-card rounded-lg shadow-sm border border-border">
                            <div className="text-center text-muted-foreground flex flex-col items-center">
                                <Settings size={48} className="mx-auto mb-2 opacity-20" />
                                <p className="mb-4">No hay áreas configuradas.</p>
                                <Button onClick={() => setIsAreaModalOpen(true)}>
                                    <Plus size={18} className="mr-2" />
                                    Crear Primera Área
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 bg-card rounded-lg shadow-sm border border-border flex flex-col overflow-hidden">
                            {/* Status Legend with Edit Button */}
                            <div className="flex items-center justify-center px-3 py-2 shrink-0 relative">
                                {/* Centered Status Legend */}
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: 'var(--color-table-free)', filter: 'brightness(0.95)' }}>
                                        <span style={{ color: 'black', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}>Libre</span>
                                    </div>
                                    <div className="flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: 'var(--color-table-occupied)', filter: 'brightness(0.95)' }}>
                                        <span style={{ color: 'black', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}>Ocupada</span>
                                    </div>
                                    <div className="flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: 'var(--color-table-payment)', filter: 'brightness(0.95)' }}>
                                        <span style={{ color: 'black', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}>Por Pagar</span>
                                    </div>
                                    <div className="flex items-center justify-center px-2 py-0.5 rounded text-[9px] font-semibold" style={{ backgroundColor: 'var(--color-table-reserved)', filter: 'brightness(0.95)' }}>
                                        <span style={{ color: 'black', textShadow: '0 1px 1px rgba(255,255,255,0.5)' }}>Reservada</span>
                                    </div>
                                </div>

                                {/* Edit Button and Action Icons - Positioned absolutely to the right */}
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {/* Action Icons - appear in edit mode */}
                                    <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ${
                                        mode === 'edit' ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'
                                    }`}>
                                        {/* Add Table */}
                                        <button
                                            onClick={handleAddTable}
                                            disabled={isCreatingTable}
                                            className="p-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                            title="Agregar Mesa"
                                        >
                                            <Plus size={14} />
                                        </button>
                                        
                                        {/* Save */}
                                        <button
                                            onClick={handleSaveLayout}
                                            disabled={!unsavedChanges}
                                            className={`p-1.5 rounded-md transition-colors ${
                                                unsavedChanges 
                                                    ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                                            }`}
                                            title="Guardar"
                                        >
                                            <Save size={14} />
                                        </button>
                                        
                                        {/* Cancel */}
                                        <button
                                            onClick={() => {
                                                if (unsavedChanges) {
                                                    if (!window.confirm('Tienes cambios sin guardar. ¿Deseas descartarlos?')) {
                                                        return;
                                                    }
                                                    loadTables();
                                                }
                                                setMode('view');
                                                setSelectedTableId(null);
                                                setUnsavedChanges(false);
                                            }}
                                            className="p-1.5 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                            title="Cancelar"
                                        >
                                            <X size={14} />
                                        </button>
                                        
                                        {/* Delete Area */}
                                        <button
                                            onClick={handleDeleteArea}
                                            className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                                            title="Eliminar Área"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                    
                                    {/* Edit Mode Toggle Button */}
                                    <button
                                        onClick={() => mode === 'view' ? setMode('edit') : setMode('view')}
                                        className={`p-1.5 rounded-md transition-all duration-200 ${
                                            mode === 'edit' 
                                                ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                                                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                        }`}
                                        title={mode === 'view' ? 'Modo Edición' : 'Salir de Edición'}
                                    >
                                        <Edit3 size={14} />
                                    </button>
                                </div>
                            </div>
                            
                            {/* Map Container - Takes remaining space */}
                            <div className="flex-1 overflow-hidden p-2">
                                <TableMap
                                    tables={currentTables}
                                    readOnly={mode === 'view'}
                                    isEditMode={mode === 'edit'}
                                    onTableClick={handleTableClick}
                                    onTableDoubleClick={handleTableDoubleClick}
                                    onTableMove={handleTableMove}
                                    onTableResize={handleTableResize}
                                    selectedTableId={selectedTableId || undefined}
                                    gridColumns={GRID_COLUMNS}
                                    gridRows={GRID_ROWS}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </FadeIn>

            {/* Create Area Modal */}
            <Modal
                isOpen={isAreaModalOpen}
                onClose={() => setIsAreaModalOpen(false)}
                title="Nueva Área"
            >
                <form onSubmit={handleCreateArea}>
                    <div className="my-4">
                        <Input
                            label="Nombre del Área"
                            value={areaFormData.name}
                            onChange={(e) => setAreaFormData({ name: e.target.value })}
                            placeholder="Ej: Salón, Terraza, PB - Barra, P1 - Salón"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button type="button" variant="ghost" onClick={() => setIsAreaModalOpen(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit">
                            Crear
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Waiter Selection Modal */}
            <Modal
                isOpen={isWaiterModalOpen}
                onClose={() => setIsWaiterModalOpen(false)}
                title={`Abrir Mesa ${tableToOpen?.name || ''}`}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">
                            Seleccionar Mozo
                        </label>
                        <select
                            value={selectedWaiterId}
                            onChange={(e) => setSelectedWaiterId(e.target.value)}
                            className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                        >
                            <option value="">Sin mozo asignado</option>
                            {waiters.map(w => (
                                <option key={w.id} value={w.id}>
                                    {w.first_name} {w.last_name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {waiters.length === 0 && (
                        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg flex items-center gap-2">
                            <Users size={16} />
                            <span>
                                No hay mozos activos. 
                                <button 
                                    onClick={() => {
                                        setIsWaiterModalOpen(false);
                                        navigate('/personal');
                                    }}
                                    className="text-primary underline ml-1 hover:text-primary/80"
                                >
                                    Crear mozo
                                </button>
                            </span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-4">
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsWaiterModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button 
                            onClick={confirmOpenTable}
                        >
                            Abrir Mesa
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Table Edit Modal */}
            <Modal
                isOpen={isTableEditModalOpen}
                onClose={() => {
                    setIsTableEditModalOpen(false);
                    setSelectedTableId(null);
                }}
                title={`Editar Mesa ${selectedTable?.name || ''}`}
            >
                {selectedTable && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Nombre
                            </label>
                            <input
                                type="text"
                                value={selectedTable.name}
                                onChange={(e) => handleUpdateTableProp('name', e.target.value)}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Capacidad
                            </label>
                            <input
                                type="number"
                                min="1"
                                value={selectedTable.capacity}
                                onChange={(e) => handleUpdateTableProp('capacity', Number(e.target.value))}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Forma
                            </label>
                            <div className="flex gap-2">
                                <button
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        selectedTable.shape === 'rectangle' 
                                            ? 'border-primary bg-primary/10 text-primary' 
                                            : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                                    }`}
                                    onClick={() => handleUpdateTableProp('shape', 'rectangle')}
                                >
                                    <BoxSelect size={20} />
                                    <span className="text-sm font-medium">Rectangular</span>
                                </button>
                                <button
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all ${
                                        selectedTable.shape === 'round' 
                                            ? 'border-primary bg-primary/10 text-primary' 
                                            : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                                    }`}
                                    onClick={() => handleUpdateTableProp('shape', 'round')}
                                >
                                    <Circle size={20} />
                                    <span className="text-sm font-medium">Redonda</span>
                                </button>
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                            <div className="font-medium mb-1">Información de posición:</div>
                            <div>Tamaño: {selectedTable.width}x{selectedTable.height}</div>
                            <div>Posición: ({selectedTable.position_x}, {selectedTable.position_y})</div>
                            <div className="mt-2 italic">Arrastra las esquinas en el mapa para cambiar el tamaño</div>
                        </div>

                        <div className="flex justify-between gap-2 pt-4 border-t border-border">
                            <Button 
                                variant="ghost"
                                onClick={handleDeleteTable}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 size={16} className="mr-2" />
                                Eliminar Mesa
                            </Button>
                            <Button 
                                onClick={() => {
                                    setIsTableEditModalOpen(false);
                                    setSelectedTableId(null);
                                }}
                            >
                                Cerrar
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </Layout>
    );
};

export default Tables;
