import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/r/$roomId')({
  component: lazyRouteComponent(() => import('../../../components/layout/ParticipantLayout'), 'ParticipantLayout'),
})
