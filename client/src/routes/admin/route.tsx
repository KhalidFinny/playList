import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    if (!localStorage.getItem('adminToken')) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
