import { api } from './apiClient';
import type { Product } from '../types'; // or define inline

export interface CatalogSearchResponse {
  items: Product[];
  total: number;
  page: number;
  limit: number;
}

export async function getCatalog(
  query: string = 'laptop',
  page: number = 1,
  limit: number = 24,
): Promise<CatalogSearchResponse> {
  const res = await api.get<CatalogSearchResponse>(
    `/api/ebay/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`,
  );
  return res;
}
