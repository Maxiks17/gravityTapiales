import { supabase } from './supabaseClient';
import type { PaginationResponse } from '../hooks/useServerPagination';

export interface Product {
    id: string;
    sku?: string | null;
    name: string;
    description?: string;
    category_id?: string;
    subcategory_id?: string;
    brand_id?: string;
    cost_price: number;
    sale_price: number;
    stock_quantity: number;
    min_stock_level: number;
    min_stock_quantity?: number;
    unit_type?: string;
    image_url?: string;
    is_active: boolean;
    tax_rate?: number;
    product_type?: 'simple' | 'composite';
    linked_stock_id?: string;
    allows_custom_quantity?: boolean;
    category?: { name: string };
    brand?: { name: string };
    created_at?: string;
    updated_at?: string;
}

export const productService = {
    _cleanUuidFields(obj: Record<string, any>): Record<string, any> {
        const uuidFields = ['category_id', 'subcategory_id', 'brand_id', 'linked_stock_id'];
        const cleaned = { ...obj };
        for (const field of uuidFields) {
            if (cleaned[field] === '' || cleaned[field] === undefined) {
                cleaned[field] = null;
            }
        }
        return cleaned;
    },

    async getAll() {
        const { data, error } = await supabase
            .from('products')
            .select('*, category:categories(name), brand:brands(name)')
            .eq('is_active', true)
            .order('name');

        if (error) throw error;
        return data as Product[];
    },

    /**
     * Enrich an array of products with real stock quantities from the stocks table.
     * - Simple products (with linked_stock_id): stock from the stocks table
     * - Composite products: calculated from composition (min units available across all ingredients)
     * - Products without stock link: keep the original stock_quantity
     */
    async _enrichWithRealStock(products: Product[]): Promise<Product[]> {
        if (!products || products.length === 0) return products;

        // 1. Fetch all active stocks in one query
        const { data: stocks, error: stocksError } = await supabase
            .from('stocks')
            .select('id, quantity')
            .eq('is_active', true);

        if (stocksError) throw stocksError;
        const stockMap = new Map((stocks || []).map(s => [s.id, s.quantity as number]));

        // 2. Fetch all compositions for composite products in one query
        const compositeProductIds = products
            .filter(p => p.product_type === 'composite')
            .map(p => p.id);

        const compositionMap = new Map<string, { stock_id: string; factor: number }[]>();
        if (compositeProductIds.length > 0) {
            const { data: compositions, error: compError } = await supabase
                .from('product_composition')
                .select('product_id, stock_id, factor')
                .in('product_id', compositeProductIds);

            if (compError) throw compError;

            for (const comp of (compositions || [])) {
                const existing = compositionMap.get(comp.product_id) || [];
                existing.push({ stock_id: comp.stock_id, factor: comp.factor });
                compositionMap.set(comp.product_id, existing);
            }
        }

        // 3. Enrich products with real stock
        return products.map(product => {
            if (product.product_type === 'composite') {
                const compositions = compositionMap.get(product.id);
                if (compositions && compositions.length > 0) {
                    let maxUnits = Infinity;
                    for (const comp of compositions) {
                        const available = stockMap.get(comp.stock_id) ?? 0;
                        const unitsFromThis = comp.factor > 0 ? available / comp.factor : Infinity;
                        maxUnits = Math.min(maxUnits, unitsFromThis);
                    }
                    return {
                        ...product,
                        stock_quantity: maxUnits === Infinity ? 0 : Math.floor(maxUnits * 10000) / 10000,
                    };
                }
                return { ...product, stock_quantity: 0 };
            } else if (product.linked_stock_id) {
                const realQty = stockMap.get(product.linked_stock_id);
                return {
                    ...product,
                    stock_quantity: realQty ?? product.stock_quantity,
                };
            }
            return product;
        });
    },

    /**
     * Fetch all active products with real stock quantities.
     */
    async getAllWithRealStock(): Promise<Product[]> {
        const products = await this.getAll();
        return this._enrichWithRealStock(products);
    },

    async getPaginated(page: number = 1, pageSize: number = 10, searchTerm: string = ''): Promise<PaginationResponse<Product>> {
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;

        let countQuery = supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        let dataQuery = supabase
            .from('products')
            .select('*, category:categories(name), brand:brands(name)')
            .eq('is_active', true);

        // Aplicar filtro de búsqueda si existe
        if (searchTerm) {
            countQuery = countQuery.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
            dataQuery = dataQuery.or(`name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
        }

        const { count } = await countQuery;

        const { data, error } = await dataQuery
            .order('name')
            .range(from, to);

        if (error) throw error;

        // Enrich with real stock from inventory
        const enrichedData = await this._enrichWithRealStock(data as Product[]);

        return {
            data: enrichedData,
            total: count || 0,
            page,
            pageSize,
            totalPages: Math.ceil((count || 0) / pageSize),
        };
    },

    async getById(id: string) {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data as Product;
    },

    async create(product: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'category' | 'brand'>) {
        const { category, brand, ...rest } = product as any;
        const cleanProduct = this._cleanUuidFields(rest);
        cleanProduct.tax_rate = Number(cleanProduct.tax_rate ?? 5) || 5;
        const productType = cleanProduct.product_type || 'simple';

        // Extract stock_quantity — it's used for initial stock creation but not stored on products table
        const initialStockQuantity = cleanProduct.stock_quantity || 0;
        delete cleanProduct.stock_quantity;
        // min_stock_quantity is also a virtual field, not in DB
        delete cleanProduct.min_stock_quantity;

        // For simple products, create a linked stock automatically
        if (productType === 'simple') {
            // First create the stock
            const { data: stock, error: stockError } = await supabase
                .from('stocks')
                .insert({
                    name: cleanProduct.name,
                    quantity: initialStockQuantity,
                    min_stock_level: cleanProduct.min_stock_level || 0,
                    cost_price: cleanProduct.cost_price || 0,
                })
                .select()
                .single();

            if (stockError) throw stockError;

            // Register initial movement if there's stock
            if (initialStockQuantity > 0) {
                await supabase.from('stock_movements').insert({
                    stock_id: stock.id,
                    movement_type: 'initial',
                    quantity: initialStockQuantity,
                    quantity_before: 0,
                    quantity_after: initialStockQuantity,
                    reason: 'Stock inicial al crear producto',
                });
            }

            // Set the linked_stock_id
            cleanProduct.linked_stock_id = stock.id;
        }

        const { data, error } = await supabase
            .from('products')
            .insert(cleanProduct)
            .select('*, category:categories(name), brand:brands(name)')
            .single();

        if (error) throw error;
        return data as Product;
    },

    async update(id: string, product: Partial<Product>) {
        const { category, brand, ...rest } = product as any;
        const cleanProduct = this._cleanUuidFields(rest);
        cleanProduct.tax_rate = Number(cleanProduct.tax_rate ?? 5) || 5;
        // stock_quantity is virtual (from stocks table), not stored on products
        delete cleanProduct.stock_quantity;
        delete cleanProduct.min_stock_quantity;

        const { data, error } = await supabase
            .from('products')
            .update(cleanProduct)
            .eq('id', id)
            .select('*, category:categories(name), brand:brands(name)')
            .single();

        if (error) throw error;
        return data as Product;
    },

    async delete(id: string) {
        const { error } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', id);

        if (error) throw error;
    },

    async getLinkedStock(productId: string): Promise<{ id: string; name: string } | null> {
        const { data: product } = await supabase
            .from('products')
            .select('linked_stock_id, product_type')
            .eq('id', productId)
            .single();

        if (!product?.linked_stock_id) return null;

        const { data: stock } = await supabase
            .from('stocks')
            .select('id, name')
            .eq('id', product.linked_stock_id)
            .single();

        return stock || null;
    },

    async deleteWithStock(id: string): Promise<void> {
        // Get linked stock first
        const { data: product } = await supabase
            .from('products')
            .select('linked_stock_id')
            .eq('id', id)
            .single();

        // Soft delete the product
        const { error: productError } = await supabase
            .from('products')
            .update({ is_active: false })
            .eq('id', id);

        if (productError) throw productError;

        // Soft delete linked stock if exists
        if (product?.linked_stock_id) {
            await supabase
                .from('stocks')
                .update({ is_active: false })
                .eq('id', product.linked_stock_id);
        }
    },

    async uploadImage(file: File) {
        const fileName = `${Date.now()}-${file.name}`;
        const { error } = await supabase.storage
            .from('products')
            .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
            .from('products')
            .getPublicUrl(fileName);

        return publicUrl;
    }
};
