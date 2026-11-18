import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText, FileDown } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { categoryService, type Category } from '../services/categoryService';
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
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import pageStyles from '../styles/page-layout.module.css';
import moduleStyles from './Categories.module.css';
const styles = { ...pageStyles, ...moduleStyles };

const Categories: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCategory, setCurrentCategory] = useState<Partial<Category>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const {
        data: categories,
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
        fetchFunction: categoryService.getPaginated,
        pageSize: 20,
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleOpenModal = (category?: Category) => {
        if (category) {
            setCurrentCategory(category);
        } else {
            setCurrentCategory({ is_active: true, print_separately: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentCategory({});
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (currentCategory.id) {
                await categoryService.update(currentCategory.id, currentCategory);
            } else {
                await categoryService.create(currentCategory as any);
            }
            handleCloseModal();
            await refresh();
        } catch (error) {
            console.error('Error saving category:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar esta categoría?')) {
            try {
                await categoryService.delete(id);
                await refresh();
            } catch (error) {
                console.error('Error deleting category:', error);
            }
        }
    };

    const handleExportAll = async () => {
        const allCategories = await categoryService.getAll();
        return allCategories;
    };

    return (
        <Layout title="Categorías">
            <FadeIn>
                <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerActions}>
                        <div className={styles.exportGroup}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    const allCategories = await handleExportAll();
                                    exportToCSV(
                                        allCategories.map(c => ({
                                        nombre: c.name,
                                        descripcion: c.description || '-'
                                    })),
                                    'categorias',
                                    [
                                        { header: 'Nombre', key: 'nombre' },
                                        { header: 'Descripción', key: 'descripcion' }
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
                                    const allCategories = await handleExportAll();
                                    exportToPDF(
                                        allCategories.map(c => ({
                                        nombre: c.name,
                                        descripcion: c.description || '-'
                                    })),
                                    'categorias',
                                    [
                                        { header: 'Nombre', key: 'nombre' },
                                        { header: 'Descripción', key: 'descripcion' }
                                    ],
                                    'Listado de Categorías'
                                    );
                                }}
                                title="Exportar a PDF"
                            >
                                <FileDown size={18} />
                            </Button>
                        </div>
                        <Button onClick={() => handleOpenModal()} size="sm">
                            <Plus size={18} style={{ marginRight: '0.5rem' }} />
                            Agregar Categoría
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <LoadingPlaceholder lines={5} />
                ) : categories.length === 0 ? (
                    <div className={styles.emptyState}>
                        <p>No se encontraron categorías. Agrega una para comenzar.</p>
                    </div>
                ) : (
                    <div>
                        {!isMobile && (
                            <div className={styles.tableWrapper}>
                                <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {categories.map((category) => (
                                    <TableRow key={category.id}>
                                        <TableCell>{category.name}</TableCell>
                                        <TableCell>{category.description || '-'}</TableCell>
                                        <TableCell>
                                            <div className={styles.actions}>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenModal(category); }}>
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(category.id); }}>
                                                    <Trash2 size={16} color="var(--color-error)" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                        </div>
                        )}
                        
                        {isMobile && (
                            <div className={styles.mobileCardList}>
                                {categories.map((category) => (
                                    <div key={category.id} className={styles.mobileCard}>
                                        <div className={styles.mobileCardHeader}>
                                            <div className={styles.mobileCardInfo}>
                                                <h3 className={styles.mobileCardTitle}>{category.name}</h3>
                                                {category.description && (
                                                    <p className={styles.mobileCardSubtitle}>{category.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardActions}>
                                            <Button variant="secondary" size="sm" onClick={() => handleOpenModal(category)}>
                                                <Edit2 size={16} />
                                                Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(category.id)}>
                                                <Trash2 size={16} color="var(--color-error)" />
                                                Eliminar
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    
                    {totalPages > 1 && (
                        <div className="flex justify-center mt-4">
                            <Pagination>
                                <PaginationContent>
                                    <PaginationItem>
                                        <PaginationPrevious 
                                            onClick={previousPage}
                                            className={!hasPreviousPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                        />
                                    </PaginationItem>
                                    
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                        <PaginationItem key={page}>
                                            <PaginationLink
                                                onClick={() => goToPage(page)}
                                                isActive={currentPage === page}
                                                className="cursor-pointer"
                                            >
                                                {page}
                                            </PaginationLink>
                                        </PaginationItem>
                                    ))}
                                    
                                    <PaginationItem>
                                        <PaginationNext 
                                            onClick={nextPage}
                                            className={!hasNextPage ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                                        />
                                    </PaginationItem>
                                </PaginationContent>
                            </Pagination>
                        </div>
                    )}
                    </div>
                )}

                <Modal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    title={currentCategory.id ? 'Editar Categoría' : 'Nueva Categoría'}
                >
                    <form onSubmit={handleSave} className={styles.form}>
                        <Input
                            label="Nombre"
                            value={currentCategory.name || ''}
                            onChange={(e) => setCurrentCategory({ ...currentCategory, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Descripción"
                            value={currentCategory.description || ''}
                            onChange={(e) => setCurrentCategory({ ...currentCategory, description: e.target.value })}
                        />
                        <div style={{ marginTop: 'var(--spacing-md)' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={currentCategory.print_separately !== false}
                                    onChange={(e) => setCurrentCategory({ ...currentCategory, print_separately: e.target.checked })}
                                />
                                <span>Imprimir por separado</span>
                            </label>
                            <small style={{ color: 'var(--color-text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                                Si el punto de venta tiene activada la opción "Imprimir tickets separados por categoría", se imprimirá un ticket para esta categoría con los productos relacionados.
                            </small>
                        </div>
                        <div className={styles.formActions}>
                            <Button type="button" variant="secondary" onClick={handleCloseModal}>
                                Cancelar
                            </Button>
                            <Button type="submit" isLoading={isSaving}>
                                Guardar
                            </Button>
                        </div>
                    </form>
                </Modal>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Categories;
