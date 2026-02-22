import { api } from './apiClient';
import type { Product } from '../types'; // or define inline


export async function getCatalog(query: string = 'laptop'): Promise<Product[]> {
  const res = await api.get<{ items: Product[] }>(`/api/ebay/search?q=${query}`);
  return res.items; 
}