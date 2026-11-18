import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, Image as ImageIcon, FileDown, FileText, LayoutList, LayoutGrid } from 'lucide-react';
import { exportToCSV, exportToPDF } from '../utils/exportUtils';
import { productService, type Product } from '../services/productService';
import { categoryService, type Category } from '../services/categoryService';
import { brandService, type Brand } from '../services/brandService';
import { productCompositionService } from '../services/productCompositionService';
import { Button } from '../components/ui/Button';
import LoadingPlaceholder from '../components/ui/LoadingPlaceholder';
import CompositionEditor, { type CompositionItem } from '../components/products/CompositionEditor';
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
import { useTenant } from '../context/TenantContext';
import { usePOSData } from '../context/POSDataContext';
import { taxRateTypeService, type TaxRateType } from '../services/taxRateTypeService';
import pageStyles from '../styles/page-layout.module.css';
import moduleStyles from './Products.module.css';
const styles = { ...pageStyles, ...moduleStyles };

const Products: React.FC = () => {
    const { currentTenant } = useTenant();
    const { refreshData } = usePOSData();
    const [categories, setCategories] = useState<Category[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [taxRateTypes, setTaxRateTypes] = useState<TaxRateType[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [productType, setProductType] = useState<'simple' | 'composite'>('simple');
    const [compositionItems, setCompositionItems] = useState<CompositionItem[]>([]);
    
    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const {
        data: products,
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
        fetchFunction: (page, pageSize) => productService.getPaginated(page, pageSize, debouncedSearchTerm),
        pageSize: 20,
        dependencies: [debouncedSearchTerm],
    });
    
    // Helper function to get page numbers to display
    const getPageNumbers = () => {
        if (totalPages <= 7) {
            // Si hay 7 o menos páginas, mostrar todas
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }
        
        const pages: number[] = [];
        
        // Siempre incluir la primera página
        pages.push(1);
        
        // Calcular el rango de páginas contiguas a mostrar
        let startPage: number;
        let endPage: number;
        
        if (currentPage <= 3) {
            // Cerca del inicio: mostrar 1, 2, 3, 4, ..., última
            startPage = 2;
            endPage = 5;
        } else if (currentPage >= totalPages - 2) {
            // Cerca del final: mostrar 1, ..., últimas 4
            startPage = totalPages - 4;
            endPage = totalPages - 1;
        } else {
            // En el medio: mostrar 1, ..., actual-1, actual, actual+1, ..., última
            startPage = currentPage - 1;
            endPage = currentPage + 1;
        }
        
        // Agregar ellipsis si hay gap después de la primera página
        if (startPage > 2) {
            pages.push(-1); // -1 representa ellipsis
        }
        
        // Agregar páginas del rango
        for (let i = startPage; i <= endPage; i++) {
            if (i > 1 && i < totalPages) {
                pages.push(i);
            }
        }
        
        // Agregar ellipsis si hay gap antes de la última página
        if (endPage < totalPages - 1) {
            pages.push(-1); // -1 representa ellipsis
        }
        
        // Siempre incluir la última página
        if (totalPages > 1) {
            pages.push(totalPages);
        }
        
        return pages;
    };
    
    // Determinar si SKU es obligatorio
    const skuRequired = !currentTenant?.settings?.allow_products_without_sku || 
                       currentTenant?.settings?.allow_products_without_sku === 'false';

    useEffect(() => {
        loadMetadata();

        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const loadMetadata = async () => {
        try {
            const [categoriesData, brandsData, taxRatesData] = await Promise.all([
                categoryService.getAll(),
                brandService.getAll(),
                taxRateTypeService.getAll(),
            ]);
            setCategories(categoriesData);
            setBrands(brandsData);
            setTaxRateTypes(taxRatesData);
        } catch (error) {
            console.error('Error loading metadata:', error);
        }
    };

    const handleExportAll = async () => {
        return await productService.getAllWithRealStock();
    };

    const handleOpenModal = async (product?: Product) => {
        if (product) {
            setCurrentProduct({
                ...product,
                tax_rate: product.tax_rate ?? 5,
            });
            const type = (product as any).product_type || 'simple';
            setProductType(type);
            if (type === 'composite') {
                try {
                    const compositions = await productCompositionService.getByProduct(product.id);
                    setCompositionItems(compositions.map(c => ({
                        id: c.id,
                        stock_id: c.stock_id,
                        stock: c.stock as any,
                        factor: c.factor,
                    })));
                } catch (error) {
                    console.error('Error loading composition:', error);
                    setCompositionItems([]);
                }
            } else {
                setCompositionItems([]);
            }
        } else {
            setCurrentProduct({
                is_active: true,
                stock_quantity: 0,
                min_stock_level: 0,
                tax_rate: 5,
            });
            setProductType('simple');
            setCompositionItems([]);
        }
        setImageFile(null);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentProduct({});
        setImageFile(null);
        setProductType('simple');
        setCompositionItems([]);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let imageUrl = currentProduct.image_url;

            if (imageFile) {
                imageUrl = await productService.uploadImage(imageFile);
            }

            const productData = {
                ...currentProduct,
                image_url: imageUrl,
                sku: currentProduct.sku?.trim() || null,
                product_type: productType,
                tax_rate: Number(currentProduct.tax_rate ?? 5),
                allows_custom_quantity: productType === 'composite' ? (currentProduct.allows_custom_quantity || false) : false,
            };

            let savedProductId: string;

            if (currentProduct.id) {
                await productService.update(currentProduct.id, productData);
                savedProductId = currentProduct.id;
            } else {
                const payload = productData as unknown as Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category' | 'brand'>;
                const newProduct = await productService.create(payload);
                savedProductId = newProduct.id;
            }

            if (productType === 'composite') {
                await productCompositionService.setComposition(
                    savedProductId,
                    compositionItems.map(item => ({
                        stock_id: item.stock_id,
                        factor: item.factor,
                    }))
                );
            } else if (currentProduct.id) {
                await productCompositionService.setComposition(savedProductId, []);
            }
            refresh();
            // Actualizar datos del POS para que estén sincronizados
            await refreshData();
            handleCloseModal();
        } catch (error) {
            console.error('Error saving product:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            const linkedStock = await productService.getLinkedStock(id);

            let confirmMessage = '¿Estás seguro de que deseas eliminar este producto?';
            if (linkedStock) {
                confirmMessage = `Este producto tiene un insumo vinculado en el inventario ("${linkedStock.name}").\n\n¿Desea eliminar tanto el producto como el insumo asociado?`;
            }

            if (window.confirm(confirmMessage)) {
                await productService.deleteWithStock(id);
                refresh();
                await refreshData();
            }
        } catch (error) {
            console.error('Error deleting product:', error);
            alert('Error al eliminar el producto');
        }
    };

    return (
        <Layout title="Productos">
            <FadeIn>
                <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.headerActions}>
                        <SearchBar
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Buscar productos..."
                        />
                        <div className={styles.exportGroup}>
                            <Button
                                variant={viewMode === 'list' ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('list')}
                                title="Vista de lista"
                            >
                                <LayoutList size={18} />
                            </Button>
                            <Button
                                variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('grid')}
                                title="Vista de cuadrícula"
                            >
                                <LayoutGrid size={18} />
                            </Button>
                        </div>
                        <div className={styles.exportGroup}>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                    const allProducts = await handleExportAll();
                                    exportToCSV(
                                        allProducts.map(p => ({
                                            nombre: p.name,
                                            sku: p.sku || 'Sin SKU',
                                            categoria: p.category?.name || '-',
                                            marca: p.brand?.name || '-',
                                            stock: p.stock_quantity,
                                            precio: p.sale_price
                                        })),
                                        'productos',
                                        [
                                            { header: 'Nombre', key: 'nombre' },
                                            { header: 'SKU', key: 'sku' },
                                            { header: 'Categoría', key: 'categoria' },
                                            { header: 'Marca', key: 'marca' },
                                            { header: 'Stock', key: 'stock' },
                                            { header: 'Precio', key: 'precio' }
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
                                    const allProducts = await handleExportAll();
                                    exportToPDF(
                                        allProducts.map(p => ({
                                            nombre: p.name,
                                            sku: p.sku || 'Sin SKU',
                                            categoria: p.category?.name || '-',
                                            marca: p.brand?.name || '-',
                                            stock: p.stock_quantity,
                                            precio: p.sale_price
                                        })),
                                        'productos',
                                        [
                                            { header: 'Nombre', key: 'nombre' },
                                            { header: 'SKU', key: 'sku' },
                                            { header: 'Categoría', key: 'categoria' },
                                            { header: 'Marca', key: 'marca' },
                                            { header: 'Stock', key: 'stock' },
                                            { header: 'Precio', key: 'precio' }
                                        ],
                                        'Listado de Productos'
                                    );
                                }}
                                title="Exportar a PDF"
                            >
                                <FileDown size={18} />
                            </Button>
                        </div>
                        <Button onClick={() => handleOpenModal()} size="sm">
                            <Plus size={18} style={{ marginRight: '0.5rem' }} />
                            Agregar Producto
                        </Button>
                    </div>
                </div>

                {viewMode === 'list' ? (
                    loading ? (
                        <LoadingPlaceholder />
                    ) : products.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                            No se encontraron productos. Agrega uno para comenzar.
                        </div>
                    ) : (
                        <div>
                            {/* Desktop Table View */}
                            {!isMobile && (
                            <div className={styles.tableWrapper}>
                                <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Imagen</TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>SKU</TableHead>
                                    <TableHead>Categoría</TableHead>
                                    <TableHead>Marca</TableHead>
                                    <TableHead>Stock</TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.map((product) => (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            {product.image_url ? (
                                                <img 
                                                    src={product.image_url} 
                                                    alt={product.name} 
                                                    style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }} 
                                                />
                                            ) : (
                                                <ImageIcon size={24} color="var(--color-text-muted)" />
                                            )}
                                        </TableCell>
                                        <TableCell>{product.name}</TableCell>
                                        <TableCell>{product.sku || 'Sin SKU'}</TableCell>
                                        <TableCell>{product.category?.name || '-'}</TableCell>
                                        <TableCell>{product.brand?.name || '-'}</TableCell>
                                        <TableCell>{product.stock_quantity}</TableCell>
                                        <TableCell>${product.sale_price}</TableCell>
                                        <TableCell>
                                            <div className={styles.actions}>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        handleOpenModal(product); 
                                                    }}
                                                >
                                                    <Edit2 size={16} />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        handleDelete(product.id); 
                                                    }}
                                                >
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

                            {/* Mobile Card View */}
                            {isMobile && (
                                <div className={styles.mobileCardList}>
                                    {products.map((product) => (
                                        <div key={product.id} className={styles.mobileCard}>
                                            <div className={styles.mobileCardHeader}>
                                                <div className={styles.mobileCardImage}>
                                                    {product.image_url ? (
                                                        <img 
                                                            src={product.image_url} 
                                                            alt={product.name} 
                                                        />
                                                    ) : (
                                                        <ImageIcon size={32} color="var(--color-text-muted)" />
                                                    )}
                                                </div>
                                                <div className={styles.mobileCardInfo}>
                                                    <h3 className={styles.mobileCardTitle}>{product.name}</h3>
                                                    <p className={styles.mobileCardSku}>{product.sku || 'Sin SKU'}</p>
                                                </div>
                                            </div>
                                            <div className={styles.mobileCardDetails}>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Categoría:</span>
                                                    <span>{product.category?.name || '-'}</span>
                                                </div>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Marca:</span>
                                                    <span>{product.brand?.name || '-'}</span>
                                                </div>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Stock:</span>
                                                    <span className={styles.mobileCardStock}>{product.stock_quantity}</span>
                                                </div>
                                                <div className={styles.mobileCardRow}>
                                                    <span className={styles.mobileCardLabel}>Precio:</span>
                                                    <span className={styles.mobileCardPrice}>${product.sale_price}</span>
                                                </div>
                                            </div>
                                            <div className={styles.mobileCardActions}>
                                                <Button 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    onClick={() => handleOpenModal(product)}
                                                >
                                                    <Edit2 size={16} />
                                                    Editar
                                                </Button>
                                                <Button 
                                                    variant="danger" 
                                                    size="sm" 
                                                    onClick={() => handleDelete(product.id)}
                                                >
                                                    <Trash2 size={16} />
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
                                            
                                            {getPageNumbers().map((page, index) => (
                                                page === -1 ? (
                                                    <PaginationItem key={`ellipsis-${index}`}>
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
                    )
                ) : (
                    <div>
                        <div className={styles.productGrid}>
                        {loading ? (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <LoadingPlaceholder />
                            </div>
                        ) : products.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--color-text-secondary)' }}>
                                No se encontraron productos. Agrega uno para comenzar.
                            </div>
                        ) : (
                            products.map((product) => (
                                <div key={product.id} className={styles.productCard}>
                                    <div className={styles.productImageContainer}>
                                        {product.image_url ? (
                                            <img 
                                                src={product.image_url} 
                                                alt={product.name} 
                                                className={styles.productImage}
                                            />
                                        ) : (
                                            <div className={styles.productImagePlaceholder}>
                                                <ImageIcon size={48} color="var(--color-text-muted)" />
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.productInfo}>
                                        <h3 className={styles.productName}>{product.name}</h3>
                                        <p className={styles.productSku}>SKU: {product.sku || 'Sin SKU'}</p>
                                        <div className={styles.productDetails}>
                                            <span className={styles.productCategory}>
                                                {product.category?.name || '-'}
                                            </span>
                                            <span className={styles.productBrand}>
                                                {product.brand?.name || '-'}
                                            </span>
                                        </div>
                                        <div className={styles.productFooter}>
                                            <div className={styles.productPrice}>
                                                <span className={styles.priceLabel}>Precio:</span>
                                                <span className={styles.priceValue}>${product.sale_price}</span>
                                            </div>
                                            <div className={styles.productStock}>
                                                <span className={styles.stockLabel}>Stock:</span>
                                                <span className={styles.stockValue}>{product.stock_quantity}</span>
                                            </div>
                                        </div>
                                        <div className={styles.productActions}>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleOpenModal(product)}
                                                style={{ flex: 1 }}
                                            >
                                                <Edit2 size={16} />
                                                Editar
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={() => handleDelete(product.id)}
                                                style={{ flex: 1 }}
                                            >
                                                <Trash2 size={16} color="var(--color-error)" />
                                                Eliminar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                        </div>
                    
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
                    title={currentProduct.id ? 'Editar Producto' : 'Nuevo Producto'}
                >
                    <form onSubmit={handleSave} className={styles.form}>
                        <div className={styles.formRow}>
                            <Input
                                label="Nombre *"
                                value={currentProduct.name || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, name: e.target.value })}
                                required
                            />
                            <Input
                                    label={`SKU${skuRequired ? ' *' : ' (Opcional)'}`}
                                value={currentProduct.sku || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, sku: e.target.value })}
                                required={skuRequired}
                            />
                        </div>

                        <Input
                            label="Descripción"
                            value={currentProduct.description || ''}
                            onChange={(e) => setCurrentProduct({ ...currentProduct, description: e.target.value })}
                        />

                        <div className={styles.formRow}>
                            <div>
                                <label className={styles.label}>Categoría</label>
                                <select
                                    className={styles.select}
                                    value={currentProduct.category_id || ''}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, category_id: e.target.value })}
                                >
                                    <option value="">Seleccionar Categoría</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={styles.label}>Marca</label>
                                <select
                                    className={styles.select}
                                    value={currentProduct.brand_id || ''}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, brand_id: e.target.value })}
                                >
                                    <option value="">Seleccionar Marca</option>
                                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <div>
                                <label className={styles.label}>Tipo Alícuota (%)</label>
                                <select
                                    className={styles.select}
                                    value={String(currentProduct.tax_rate ?? 5)}
                                    onChange={(e) =>
                                        setCurrentProduct({
                                            ...currentProduct,
                                            tax_rate: Number.parseInt(e.target.value, 10),
                                        })
                                    }
                                >
                                    {taxRateTypes.map((t) => (
                                        <option key={t.id} value={String(t.id)}>
                                            {t.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.formRow}>
                            <Input
                                label="Precio de Costo"
                                type="number"
                                value={currentProduct.cost_price || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, cost_price: Number(e.target.value) })}
                            />
                            <Input
                                    label="Precio de Venta  *"
                                type="number"
                                value={currentProduct.sale_price || ''}
                                onChange={(e) => setCurrentProduct({ ...currentProduct, sale_price: Number(e.target.value) })}
                                required
                            />
                        </div>

                        {/* Product Type Selector */}
                        <div className={styles.formRow}>
                            <div>
                                <label className={styles.label}>Tipo de Producto</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="productType"
                                            value="simple"
                                            checked={productType === 'simple'}
                                            onChange={() => setProductType('simple')}
                                            className="w-4 h-4"
                                            disabled={!!currentProduct.id}
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Simple</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="productType"
                                            value="composite"
                                            checked={productType === 'composite'}
                                            onChange={() => setProductType('composite')}
                                            className="w-4 h-4"
                                            disabled={!!currentProduct.id}
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Compuesto (Receta)</span>
                                    </label>
                                </div>
                                {currentProduct.id && (
                                    <p className="text-xs text-gray-500 mt-1">El tipo no se puede cambiar después de crear el producto</p>
                                )}
                            </div>
                        </div>

                        {/* Stock initial for new Simple products */}
                        {productType === 'simple' && !currentProduct.id && (
                            <div className={styles.formRow}>
                                <Input
                                    label="Stock Inicial"
                                    type="number"
                                    min="0"
                                    value={currentProduct.stock_quantity ?? 0}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, stock_quantity: Number(e.target.value) })}
                                />
                                <Input
                                    label="Stock Mínimo"
                                    type="number"
                                    min="0"
                                    value={currentProduct.min_stock_level ?? 0}
                                    onChange={(e) => setCurrentProduct({ ...currentProduct, min_stock_level: Number(e.target.value) })}
                                />
                            </div>
                        )}

                        {/* Stock notice for existing Simple products */}
                        {productType === 'simple' && currentProduct.id && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                    El stock de este producto se gestiona desde la sección de Inventario.
                                </p>
                            </div>
                        )}

                        {/* Composition Editor for Composite products */}
                        {productType === 'composite' && (
                            <div className="py-2">
                                <label className={styles.label}>Composición (Receta)</label>
                                <CompositionEditor
                                    items={compositionItems}
                                    onChange={setCompositionItems}
                                />
                            </div>
                        )}

                        {/* Custom quantity option for composite products */}
                        {productType === 'composite' && (
                            <div className="py-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={currentProduct.allows_custom_quantity || false}
                                        onChange={(e) => setCurrentProduct({
                                            ...currentProduct,
                                            allows_custom_quantity: e.target.checked
                                        })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                        Permite cantidad personalizada (venta a granel)
                                    </span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                    Al activar, el POS pedirá la cantidad exacta al agregar este producto
                                </p>
                            </div>
                        )}

                        <div>
                            <label className={styles.label}>Imagen del Producto</label>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                                className={styles.input}
                            />
                            {currentProduct.image_url && (
                                <img src={currentProduct.image_url} alt="Vista Previa" className={styles.imagePreview} />
                            )}
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

export default Products;
