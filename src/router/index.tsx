import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/AppLayout'
import { AdminDebugPage } from '@/pages/AdminDebugPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { ProductVariantsPage } from '@/pages/ProductVariantsPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products/:productSlug/variants', element: <ProductVariantsPage /> },
      { path: 'debug', element: <AdminDebugPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
