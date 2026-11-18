import React, { useEffect, useState } from 'react';
import { Plus, Edit3, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { staffService, STAFF_POSITIONS } from '../services/staffService';
import type { Staff, CreateStaffInput, UpdateStaffInput, StaffPosition } from '../types/operationMode';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { useToast } from '../context/ToastContext';
import { useTenant } from '../context/TenantContext';

const Personal: React.FC = () => {
    const { showToast } = useToast();
    const { currentTenant } = useTenant();

    // State
    const [staff, setStaff] = useState<Staff[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterPosition, setFilterPosition] = useState<StaffPosition | 'all'>('all');
    const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('active');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
    const [formData, setFormData] = useState<CreateStaffInput>({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: 'waiter',
        hire_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    useEffect(() => {
        if (currentTenant) {
            loadStaff();
        }
    }, [currentTenant]);

    const loadStaff = async () => {
        if (!currentTenant) return;

        try {
            setLoading(true);
            const data = await staffService.getAll(currentTenant.id);
            setStaff(data);
        } catch (error) {
            showToast('Error al cargar personal', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (staffMember?: Staff) => {
        if (staffMember) {
            setEditingStaff(staffMember);
            setFormData({
                first_name: staffMember.first_name,
                last_name: staffMember.last_name,
                email: staffMember.email || '',
                phone: staffMember.phone || '',
                position: staffMember.position,
                hire_date: staffMember.hire_date || new Date().toISOString().split('T')[0],
                notes: staffMember.notes || '',
            });
        } else {
            setEditingStaff(null);
            setFormData({
                first_name: '',
                last_name: '',
                email: '',
                phone: '',
                position: 'waiter',
                hire_date: new Date().toISOString().split('T')[0],
                notes: '',
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingStaff(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentTenant) return;

        try {
            if (editingStaff) {
                await staffService.update(editingStaff.id, formData as UpdateStaffInput);
                showToast('Personal actualizado correctamente', 'success');
            } else {
                await staffService.create(currentTenant.id, formData);
                showToast('Personal creado correctamente', 'success');
            }
            handleCloseModal();
            loadStaff();
        } catch (error) {
            showToast(editingStaff ? 'Error al actualizar personal' : 'Error al crear personal', 'error');
        }
    };

    const handleToggleActive = async (staffMember: Staff) => {
        try {
            if (staffMember.is_active) {
                await staffService.deactivate(staffMember.id);
                showToast(`${staffMember.first_name} ${staffMember.last_name} desactivado`, 'success');
            } else {
                await staffService.activate(staffMember.id);
                showToast(`${staffMember.first_name} ${staffMember.last_name} activado`, 'success');
            }
            loadStaff();
        } catch (error) {
            showToast('Error al cambiar estado', 'error');
        }
    };

    const handleDelete = async (staffMember: Staff) => {
        if (!confirm(`¿Eliminar a ${staffMember.first_name} ${staffMember.last_name}? Esta acción no se puede deshacer.`)) {
            return;
        }

        try {
            await staffService.delete(staffMember.id);
            showToast('Personal eliminado correctamente', 'success');
            loadStaff();
        } catch (error) {
            showToast('Error al eliminar personal', 'error');
        }
    };

    // Filtered staff
    const filteredStaff = staff.filter(s => {
        const matchesPosition = filterPosition === 'all' || s.position === filterPosition;
        const matchesActive = 
            filterActive === 'all' || 
            (filterActive === 'active' && s.is_active) ||
            (filterActive === 'inactive' && !s.is_active);
        return matchesPosition && matchesActive;
    });

    if (loading) {
        return (
            <Layout title="Personal">
                <LoadingPlaceholder />
            </Layout>
        );
    }

    return (
        <Layout title="Personal">
            <FadeIn>
                <div className="space-y-6">
                    {/* Header */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-2xl font-bold text-foreground">Personal</h1>
                            <p className="text-sm text-muted-foreground mt-1">
                                Gestiona los empleados de tu negocio
                            </p>
                        </div>
                        <Button onClick={() => handleOpenModal()}>
                            <Plus size={18} className="mr-2" />
                            Agregar Personal
                        </Button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap gap-4 bg-card p-4 rounded-lg border border-border">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium mb-2">Puesto</label>
                            <select
                                value={filterPosition}
                                onChange={(e) => setFilterPosition(e.target.value as StaffPosition | 'all')}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                            >
                                <option value="all">Todos los puestos</option>
                                {STAFF_POSITIONS.map(pos => (
                                    <option key={pos.value} value={pos.value}>{pos.label}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium mb-2">Estado</label>
                            <select
                                value={filterActive}
                                onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
                                className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                            >
                                <option value="all">Todos</option>
                                <option value="active">Activos</option>
                                <option value="inactive">Inactivos</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <div className="text-sm text-muted-foreground">
                                {filteredStaff.length} {filteredStaff.length === 1 ? 'empleado' : 'empleados'}
                            </div>
                        </div>
                    </div>

                    {/* Staff List */}
                    {filteredStaff.length === 0 ? (
                        <div className="text-center py-12 bg-card rounded-lg border border-border">
                            <Users size={48} className="mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium text-foreground mb-2">
                                No hay personal registrado
                            </h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                Comienza agregando tu primer empleado
                            </p>
                            <Button onClick={() => handleOpenModal()}>
                                <Plus size={18} className="mr-2" />
                                Agregar Personal
                            </Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredStaff.map(member => (
                                <div
                                    key={member.id}
                                    className={`bg-card rounded-lg border p-4 transition-all ${
                                        member.is_active
                                            ? 'border-border hover:shadow-md'
                                            : 'border-border/50 bg-card/50 opacity-60'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-foreground">
                                                {staffService.getFullName(member)}
                                            </h3>
                                            <p className="text-sm text-primary font-medium">
                                                {staffService.getPositionLabel(member.position)}
                                            </p>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                                            member.is_active
                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                            {member.is_active ? 'Activo' : 'Inactivo'}
                                        </div>
                                    </div>

                                    {member.email && (
                                        <p className="text-sm text-muted-foreground mb-1">
                                            📧 {member.email}
                                        </p>
                                    )}
                                    {member.phone && (
                                        <p className="text-sm text-muted-foreground mb-1">
                                            📱 {member.phone}
                                        </p>
                                    )}
                                    {member.hire_date && (
                                        <p className="text-sm text-muted-foreground">
                                            📅 Ingreso: {new Date(member.hire_date).toLocaleDateString('es-AR')}
                                        </p>
                                    )}

                                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOpenModal(member)}
                                            className="flex-1"
                                        >
                                            <Edit3 size={14} className="mr-1" />
                                            Editar
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleToggleActive(member)}
                                            className="flex-1"
                                        >
                                            {member.is_active ? (
                                                <>
                                                    <UserX size={14} className="mr-1" />
                                                    Desactivar
                                                </>
                                            ) : (
                                                <>
                                                    <UserCheck size={14} className="mr-1" />
                                                    Activar
                                                </>
                                            )}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(member)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Create/Edit Modal */}
                    <Modal
                        isOpen={isModalOpen}
                        onClose={handleCloseModal}
                        title={editingStaff ? 'Editar Personal' : 'Agregar Personal'}
                    >
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Nombre / Sobrenombre"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    placeholder="Juan, Juancho, etc."
                                    required
                                />
                                <Input
                                    label="Apellido (opcional)"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                    placeholder="Pérez (opcional)"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium mb-2">Puesto</label>
                                <select
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value as StaffPosition })}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary"
                                    required
                                >
                                    {STAFF_POSITIONS.map(pos => (
                                        <option key={pos.value} value={pos.value}>{pos.label}</option>
                                    ))}
                                </select>
                            </div>

                            <Input
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />

                            <Input
                                label="Teléfono"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            />

                            <Input
                                label="Fecha de Ingreso"
                                type="date"
                                value={formData.hire_date}
                                onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                            />

                            <div>
                                <label className="block text-sm font-medium mb-2">Notas</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-border bg-background text-foreground rounded-lg focus:ring-2 focus:ring-primary min-h-[80px]"
                                    placeholder="Notas adicionales (opcional)"
                                />
                            </div>

                            <div className="flex justify-end gap-2 pt-4">
                                <Button type="button" variant="ghost" onClick={handleCloseModal}>
                                    Cancelar
                                </Button>
                                <Button type="submit">
                                    {editingStaff ? 'Actualizar' : 'Crear'}
                                </Button>
                            </div>
                        </form>
                    </Modal>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Personal;
