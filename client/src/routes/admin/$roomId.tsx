import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/$roomId')({
  component: lazyRouteComponent(() => import('../../pages/AdminDashboardPage'), 'AdminDashboardPage'),
})
