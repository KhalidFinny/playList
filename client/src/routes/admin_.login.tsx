import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/admin_/login')({
  component: lazyRouteComponent(() => import('../pages/AdminLoginPage'), 'AdminLoginPage'),
})
