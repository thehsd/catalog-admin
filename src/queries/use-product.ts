import { useQuery } from '@tanstack/react-query'
import { fetchAdminProduct, fetchProductList } from '@/api/products'
import { adminQueryKeys } from './query-keys'

export function useProductList() {
  return useQuery({
    queryKey: adminQueryKeys.productList(),
    queryFn: fetchProductList,
  })
}

/**
 * The admin's read of one product.
 *
 * `staleTime: 0` on purpose. An admin screen showing a price that is quietly out of date
 * is worse than a slightly chattier UI, and admin reads are counted separately from
 * public catalog reads anyway, so being eager here does not distort any experiment.
 */
export function useProduct(productSlug: string) {
  return useQuery({
    queryKey: adminQueryKeys.product(productSlug),
    queryFn: () => fetchAdminProduct(productSlug),
    staleTime: 0,
  })
}
