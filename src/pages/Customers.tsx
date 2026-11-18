import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Eye, FileText, FileDown } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { customerService, type Customer } from '../services/customerService';
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
import SearchBar from '../components/ui/SearchBar';
import Layout from '../components/layout/Layout';
import FadeIn from '../components/ui/FadeIn';
import { fiscalConditionService, type FiscalCondition } from '../services/fiscalConditionService';
import { TipoDocumento } from '../services/afip/constants';
import pageStyles from '../styles/page-layout.module.css';
import moduleStyles from './Customers.module.css';
const styles = { ...pageStyles, ...moduleStyles };

const DOCUMENT_TYPE_OPTIONS = [
    { value: TipoDocumento.CUIT, label: 'CUIT' },
    { value: TipoDocumento.CUIL, label: 'CUIL' },
    { value: TipoDocumento.CDI, label: 'CDI' },
    { value: TipoDocumento.LE, label: 'LE' },
    { value: TipoDocumento.LC, label: 'LC' },
    { value: TipoDocumento.CI_Extranjera, label: 'CI Extranjera' },
    { value: TipoDocumento.EnTramite, label: 'En Tramite' },
    { value: TipoDocumento.Acta_Nacimiento, label: 'Acta Nacimiento' },
    { value: TipoDocumento.CI_Bs_As_RNP, label: 'CI Bs As RNP' },
    { value: TipoDocumento.DNI, label: 'DNI' },
    { value: TipoDocumento.Pasaporte, label: 'Pasaporte' },
    { value: TipoDocumento.CI_Policia_Federal, label: 'CI Policia Federal' },
    { value: TipoDocumento.SinIdentificar_Exterior, label: 'Sin Identificar Exterior' },
];

const VALID_DOCUMENT_TYPE_VALUES = new Set<number>(Object.values(TipoDocumento));

const Customers: React.FC = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [currentCustomer, setCurrentCustomer] = useState<Partial<Customer>>({});
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [fiscalConditions, setFiscalConditions] = useState<FiscalCondition[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const loadFiscalConditions = async () => {
            try {
                const items = await fiscalConditionService.getAll();
                setFiscalConditions(items);
            } catch (error) {
                console.error('Error loading fiscal conditions:', error);
                setFiscalConditions([]);
            }
        };

        loadFiscalConditions();
    }, []);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const {
        data: customers,
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
        fetchFunction: (page, pageSize) => customerService.getPaginated(page, pageSize, debouncedSearchTerm),
        pageSize: 20,
        dependencies: [debouncedSearchTerm],
    });

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Scroll to top when page changes
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentPage]);

    const handleOpenModal = (customer?: Customer) => {
        if (customer) {
            setCurrentCustomer({
                ...customer,
                condicion_fiscal_id: customer.condicion_fiscal_id ?? 0,
            });
        } else {
            setCurrentCustomer({ is_active: true, condicion_fiscal_id: 0 });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentCustomer({});
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const sanitizedDocumentNumber = (currentCustomer.document_number || '').replace(/\D/g, '').slice(0, 20);
            const parsedDocumentType = Number(currentCustomer.document_type);
            const hasDocumentType = Number.isFinite(parsedDocumentType) && VALID_DOCUMENT_TYPE_VALUES.has(parsedDocumentType);

            if (currentCustomer.document_number && sanitizedDocumentNumber !== currentCustomer.document_number) {
                setCurrentCustomer({
                    ...currentCustomer,
                    document_number: sanitizedDocumentNumber,
                });
            }

            if (currentCustomer.id) {
                await customerService.update(currentCustomer.id, {
                    ...currentCustomer,
                    document_type: hasDocumentType ? parsedDocumentType : undefined,
                    document_number: sanitizedDocumentNumber || null,
                });
            } else {
                const payload = {
                    ...currentCustomer,
                    is_active: currentCustomer.is_active ?? true,
                    condicion_fiscal_id: Number(currentCustomer.condicion_fiscal_id ?? 0),
                    document_type: hasDocumentType ? parsedDocumentType : null,
                    document_number: sanitizedDocumentNumber || null,
                } as Omit<Customer, 'id' | 'created_at' | 'updated_at'>;

                await customerService.create(payload);
            }
            handleCloseModal();
            await refresh();
        } catch (error) {
            console.error('Error saving customer:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('¿Estás seguro de que deseas eliminar este cliente?')) {
            try {
                await customerService.delete(id);
                await refresh();
            } catch (error) {
                console.error('Error deleting customer:', error);
            }
        }
    };

    const handleViewDetails = (customer: Customer) => {
        setSelectedCustomer(customer);
        setIsDetailsModalOpen(true);
    };

    const handleCloseDetailsModal = () => {
        setIsDetailsModalOpen(false);
        setSelectedCustomer(null);
    };

    const handleExportAll = async () => {
        const allCustomers = await customerService.getAll();
        return allCustomers;
    };

    return (
        <Layout title="Clientes">
            <FadeIn>
                <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerActions}>
                        <SearchBar
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Buscar clientes..."
                        />
                        <div className={styles.exportGroup}>
                            <Button 
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    const allCustomers = await handleExportAll();
                                    exportToCSV(
                                        allCustomers.map(c => ({
                                        razon_social: c.business_name,
                                        contacto: c.contact_name || '-',
                                        email: c.email || '-',
                                        telefono: c.phone || '-',
                                        ciudad: c.city || '-'
                                    })),
                                    'clientes',
                                    [
                                        { header: 'Razón Social', key: 'razon_social' },
                                        { header: 'Contacto', key: 'contacto' },
                                        { header: 'Email', key: 'email' },
                                        { header: 'Teléfono', key: 'telefono' },
                                        { header: 'Ciudad', key: 'ciudad' }
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
                                    const allCustomers = await handleExportAll();
                                    exportToPDF(
                                        allCustomers.map(c => ({
                                        razon_social: c.business_name,
                                        contacto: c.contact_name || '-',
                                        email: c.email || '-',
                                        telefono: c.phone || '-',
                                        ciudad: c.city || '-'
                                    })),
                                    'clientes',
                                    [
                                        { header: 'Razón Social', key: 'razon_social' },
                                        { header: 'Contacto', key: 'contacto' },
                                        { header: 'Email', key: 'email' },
                                        { header: 'Teléfono', key: 'telefono' },
                                        { header: 'Ciudad', key: 'ciudad' }
                                    ],
                                    'Listado de Clientes'
                                    );
                                }}
                                title="Exportar a PDF"
                            >
                                <FileDown size={18} />
                            </Button>
                        </div>
                        <Button onClick={() => handleOpenModal()} size="sm">
                            <Plus size={18} style={{ marginRight: '0.5rem' }} />
                            Agregar Cliente
                        </Button>
                    </div>
                </div>

                {loading ? (
                    <LoadingPlaceholder />
                ) : customers.length > 0 ? (
                    <div>
                        {!isMobile && (
                            <div className={styles.tableWrapper}>
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Razón Social</TableHead>
                                        <TableHead>Contacto</TableHead>
                                        <TableHead>Correo Electrónico</TableHead>
                                        <TableHead>Teléfono</TableHead>
                                        <TableHead>Ciudad</TableHead>
                                        <TableHead>Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customers.map((customer) => (
                                        <TableRow key={customer.id} className="cursor-pointer">
                                            <TableCell className="font-medium">{customer.business_name}</TableCell>
                                            <TableCell>{customer.contact_name || '-'}</TableCell>
                                            <TableCell>{customer.email || '-'}</TableCell>
                                            <TableCell>{customer.phone || '-'}</TableCell>
                                            <TableCell>{customer.city || '-'}</TableCell>
                                            <TableCell>
                                                <div className={styles.actions}>
                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenModal(customer); }}>
                                                        <Edit2 size={16} />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}>
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
                                {customers.map((customer) => (
                                    <div key={customer.id} className={styles.mobileCard}>
                                        <div className={styles.mobileCardHeader}>
                                            <div className={styles.mobileCardInfo}>
                                                <h3 className={styles.mobileCardTitle}>{customer.business_name}</h3>
                                                <p className={styles.mobileCardSubtitle}>{customer.contact_name || '-'}</p>
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardDetails}>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Email:</span>
                                                <span className={styles.mobileCardValue}>{customer.email || '-'}</span>
                                            </div>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Teléfono:</span>
                                                <span className={styles.mobileCardValue}>{customer.phone || '-'}</span>
                                            </div>
                                            <div className={styles.mobileCardRow}>
                                                <span className={styles.mobileCardLabel}>Ciudad:</span>
                                                <span className={styles.mobileCardValue}>{customer.city || '-'}</span>
                                            </div>
                                        </div>
                                        <div className={styles.mobileCardActions}>
                                            <Button variant="secondary" size="sm" onClick={() => handleViewDetails(customer)}>
                                                <Eye size={16} />
                                                Ver
                                            </Button>
                                            <Button variant="secondary" size="sm" onClick={() => handleOpenModal(customer)}>
                                                <Edit2 size={16} />
                                                Editar
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(customer.id)}>
                                                <Trash2 size={16} color="var(--color-error)" />
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
                                    
                                    {(() => {
                                        if (totalPages <= 7) {
                                            return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                                <PaginationItem key={page}>
                                                    <PaginationLink
                                                        onClick={() => goToPage(page)}
                                                        isActive={currentPage === page}
                                                        className="cursor-pointer"
                                                    >
                                                        {page}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            ));
                                        }

                                        const pages: (number | string)[] = [1];
                                        
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
                                        
                                        if (startPage > 2) pages.push('ellipsis-start');
                                        
                                        for (let i = startPage; i <= endPage; i++) {
                                            if (i > 1 && i < totalPages) pages.push(i);
                                        }
                                        
                                        if (endPage < totalPages - 1) pages.push('ellipsis-end');
                                        
                                        if (totalPages > 1) pages.push(totalPages);
                                        
                                        return pages.map((page) => 
                                            typeof page === 'string' ? (
                                                <PaginationItem key={page}>
                                                    <span className="px-4 py-2">...</span>
                                                </PaginationItem>
                                            ) : (
                                                <PaginationItem key={page}>
                                                    <PaginationLink
                                                        onClick={() => goToPage(page)}
                                                        isActive={currentPage === page}
                                                        className="cursor-pointer"
                                                    >
                                                        {page}
                                                    </PaginationLink>
                                                </PaginationItem>
                                            )
                                        );
                                    })()}
                                    
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
                ) : (
                    <div style={{
                        padding: 'var(--spacing-xl)',
                        textAlign: 'center',
                        color: 'var(--color-text-muted)',
                    }}>
                        No se encontraron clientes. Agrega uno para comenzar.
                    </div>
                )}

                <Modal
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    title={currentCustomer.id ? 'Editar Cliente' : 'Nuevo Cliente'}
                >
                    <form onSubmit={handleSave} className={styles.form}>
                        <Input
                            label="Razón Social"
                            value={currentCustomer.business_name || ''}
                            onChange={(e) => setCurrentCustomer({ ...currentCustomer, business_name: e.target.value })}
                            required
                        />
                        <Input
                            label="Nombre de Contacto"
                            value={currentCustomer.contact_name || ''}
                            onChange={(e) => setCurrentCustomer({ ...currentCustomer, contact_name: e.target.value })}
                        />

                        <div className={styles.formRow}>
                            <div>
                                <label className={styles.label}>Tipo de Documento</label>
                                <select
                                    className={styles.select}
                                    value={currentCustomer.document_type ?? ''}
                                    onChange={(e) =>
                                        setCurrentCustomer({
                                            ...currentCustomer,
                                            document_type: e.target.value ? Number(e.target.value) : undefined,
                                        })
                                    }
                                >
                                    <option value="">Sin especificar</option>
                                    {DOCUMENT_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <Input
                                label="Numero de Documento"
                                inputMode="numeric"
                                maxLength={20}
                                value={currentCustomer.document_number || ''}
                                onChange={(e) =>
                                    setCurrentCustomer({
                                        ...currentCustomer,
                                        document_number: e.target.value.replace(/\D/g, '').slice(0, 20),
                                    })
                                }
                            />
                        </div>

                        <div>
                            <label className={styles.label}>condicion fiscal</label>
                            <select
                                className={styles.select}
                                value={Number(currentCustomer.condicion_fiscal_id ?? 0)}
                                onChange={(e) =>
                                    setCurrentCustomer({
                                        ...currentCustomer,
                                        condicion_fiscal_id: Number(e.target.value),
                                    })
                                }
                            >
                                <option value={0}>Sin especificar</option>
                                {fiscalConditions
                                    .filter((c) => c.id !== 0)
                                    .map((condition) => (
                                        <option key={condition.id} value={condition.id}>
                                            {condition.name}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className={styles.formRow}>
                            <Input
                                label="Correo Electrónico"
                                type="email"
                                value={currentCustomer.email || ''}
                                onChange={(e) => setCurrentCustomer({ ...currentCustomer, email: e.target.value })}
                            />
                            <Input
                                label="Teléfono"
                                value={currentCustomer.phone || ''}
                                onChange={(e) => setCurrentCustomer({ ...currentCustomer, phone: e.target.value })}
                            />
                        </div>
                        <Input
                            label="Dirección"
                            value={currentCustomer.address || ''}
                            onChange={(e) => setCurrentCustomer({ ...currentCustomer, address: e.target.value })}
                        />
                        <div className={styles.formRow}>
                            <Input
                                label="Ciudad"
                                value={currentCustomer.city || ''}
                                onChange={(e) => setCurrentCustomer({ ...currentCustomer, city: e.target.value })}
                            />
                            <Input
                                label="Provincia"
                                value={currentCustomer.state || ''}
                                onChange={(e) => setCurrentCustomer({ ...currentCustomer, state: e.target.value })}
                            />
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

                <Modal
                    isOpen={isDetailsModalOpen}
                    onClose={handleCloseDetailsModal}
                    title="Detalles del Cliente"
                >
                    {selectedCustomer && (
                        <div className={styles.detailsContainer}>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Razón Social:</span>
                                <span className={styles.detailValue}>{selectedCustomer.business_name}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Nombre de Contacto:</span>
                                <span className={styles.detailValue}>{selectedCustomer.contact_name || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Correo Electrónico:</span>
                                <span className={styles.detailValue}>{selectedCustomer.email || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Teléfono:</span>
                                <span className={styles.detailValue}>{selectedCustomer.phone || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Tipo de Documento:</span>
                                <span className={styles.detailValue}>
                                    {DOCUMENT_TYPE_OPTIONS.find((option) => option.value === selectedCustomer.document_type)?.label || 'N/A'}
                                </span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Numero de Documento:</span>
                                <span className={styles.detailValue}>{selectedCustomer.document_number || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Dirección:</span>
                                <span className={styles.detailValue}>{selectedCustomer.address || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Ciudad:</span>
                                <span className={styles.detailValue}>{selectedCustomer.city || 'N/A'}</span>
                            </div>
                            <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Provincia:</span>
                                <span className={styles.detailValue}>{selectedCustomer.state || 'N/A'}</span>
                            </div>
                            <div className={styles.detailsActions}>
                                <Button onClick={() => {
                                    handleCloseDetailsModal();
                                    handleOpenModal(selectedCustomer);
                                }}>
                                    Editar
                                </Button>
                                <Button variant="secondary" onClick={handleCloseDetailsModal}>
                                    Cerrar
                                </Button>
                            </div>
                        </div>
                    )}
                </Modal>
                </div>
            </FadeIn>
        </Layout>
    );
};

export default Customers;
