import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router'

export const Route = createFileRoute('/r/$roomId/')({
  component: lazyRouteComponent(() => import('../../../pages/MusicRoom'), 'MusicRoom'),
})
