import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, FileText, FileDown } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { brandService, type Brand } from '../services/brandService';
import { Button } from '../components/ui/Button';
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
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import pageStyles from '../styles/page-layout.module.css';
import moduleStyles from './Brands.module.css';
const styles = { ...pageStyles, ...moduleStyles };

const Brands: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBrand, setCurrentBrand] = useState<Partial<Brand>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const {
        data: brands,
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
        fetchFunction: brandService.getPaginated,
        pageSize: 20,
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleOpenModal = (brand?: Brand) => {
        if (brand) {
            setCurrentBrand(brand);
        } else {
            setCurrentBrand({ is_active: true });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentBrand({});
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (currentBrand.id) {
                await brandService.update(currentBrand.id, currentBrand);
            } else {
                await brandService.create(currentBrand as any);
            }
            handleCloseModal();
            await refresh();
        } catch (error) {
            console.error('Error saving brand:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar esta marca?')) {
            try {
                await brandService.delete(id);
                await refresh();
            } catch (error) {
                console.error('Error deleting brand:', error);
            }
        }
    };

    const handleExportAll = async () => {
        const allBrands = await brandService.getAll();
        return allBrands;
    };

    return (
        <Layout title="Marcas">
            <FadeIn>
                <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerActions}>
                        <div className={styles.exportGroup}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    const allBrands = await handleExportAll();
                                    exportToCSV(
                                        allBrands.map(b => ({
                                        nombre: b.name,
                                        descripcion: b.description || '-'
                                    })),
                                    'marcas',
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
                                    const allBrands = await handleExportAll();
                                    exportToPDF(
                                        allBrands.map(b => ({
                                        nombre: b.name,
                                        descripcion: b.description || '-'
                                    })),
                                    'marcas',
                                    [
                                        { header: 'Nombre', key: 'nombre' },
                                        { header: 'Descripción', key: 'descripcion' }
                                    ],
                                    'Listado de Marcas'
                                    );
                                }}
                                title="Exportar a PDF"
                            >
                                <FileDown size={18} />
                            </Button>
                        </div>
                        <Button onClick={() => handleOpenModal()} size="sm">
                            <Plus size={18} style={{ marginRight: '0.5rem' }} />
                            Agregar Marca
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <LoadingPlaceholder />
                ) : brands.length === 0 ? (
                    <p>No se encontraron marcas. Agrega una para comenzar.</p>
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
                                {brands.map((brand) => (
                                    <TableRow key={brand.id}>
                                        <TableCell>{brand.name}</TableCell>
                                        <TableCell>{brand.description || '-'}</TableCell>
                                        <TableCell>
                                            <div className={styles.actions}>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenModal(brand); }}>
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(brand.id); }}>
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
                                {brands.map((brand) => (
                                    <div key={brand.id} className={styles.mobileCard}>
                                        <div className={styles.mobileCardHeader}>
                                            <div className={styles.mobileCardInfo}>
                                                <h3 className={styles.mobileCardTitle}>{brand.name}</h3>
                                                {brand.description && (
                                                    <p className={styles.mobileCardSubtitle}>{brand.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardActions}>
                                            <Button variant="secondary" size="sm" onClick={() => handleOpenModal(brand)}>
                                                <Edit2 size={16} />
                                                Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(brand.id)}>
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
                    title={currentBrand.id ? 'Editar Marca' : 'Nueva Marca'}
                >
                    <form onSubmit={handleSave} className={styles.form}>
                        <Input
                            label="Nombre"
                            value={currentBrand.name || ''}
                            onChange={(e) => setCurrentBrand({ ...currentBrand, name: e.target.value })}
                            required
                        />
                        <Input
                            label="Descripción"
                            value={currentBrand.description || ''}
                            onChange={(e) => setCurrentBrand({ ...currentBrand, description: e.target.value })}
                        />
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

export default Brands;
