import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/r/$roomId/request')({
  component: lazyRouteComponent(() => import('../../../pages/ParticipantPage'), 'ParticipantPage'),
})
