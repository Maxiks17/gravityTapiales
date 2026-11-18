import { useState, useEffect } from 'react';

export interface PaginationResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UseServerPaginationProps<T> {
  fetchFunction: (page: number, pageSize: number) => Promise<PaginationResponse<T>>;
  pageSize?: number;
  dependencies?: any[];
}

export function useServerPagination<T>({
  fetchFunction,
  pageSize = 10,
  dependencies = [],
}: UseServerPaginationProps<T>) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Reset to page 1 when dependencies change (like search term)
  useEffect(() => {
    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  // Load data whenever page, refreshTrigger or dependencies change
  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchFunction(currentPage, pageSize);
        if (!cancelled) {
          setData(response.data);
          setTotalPages(response.totalPages);
          setTotalItems(response.total);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          console.error('Error loading paginated data:', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, refreshTrigger, ...dependencies]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const nextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const previousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const refresh = async () => {
    // Force a re-fetch by incrementing the refresh trigger
    setRefreshTrigger(prev => prev + 1);
    // Wait a bit to ensure the effect has triggered
    return new Promise<void>(resolve => setTimeout(resolve, 100));
  };

  return {
    data,
    loading,
    error,
    currentPage,
    totalPages,
    totalItems,
    goToPage,
    nextPage,
    previousPage,
    refresh,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}
