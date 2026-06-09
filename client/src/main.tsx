import { StrictMode, Suspense, lazy, useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Outlet,
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/react-router';
import './index.css';

type ModuleWithOptionalDefault = { default?: ComponentType };

const ParticipantLayout = lazy(() =>
  import('./components/layout/ParticipantLayout').then((module) => ({
    default:
      module.ParticipantLayout ??
      (module as ModuleWithOptionalDefault).default ??
      (() => null),
  })),
);

const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({
    default:
      module.LandingPage ?? (module as ModuleWithOptionalDefault).default ?? (() => null),
  })),
);
const ParticipantPage = lazy(() =>
  import('./pages/ParticipantPage').then((module) => ({
    default:
      module.ParticipantPage ??
      (module as ModuleWithOptionalDefault).default ??
      (() => null),
  })),
);
const MusicRoom = lazy(() =>
  import('./pages/MusicRoom').then((module) => ({
    default: module.MusicRoom ?? (module as ModuleWithOptionalDefault).default ?? (() => null),
  })),
);
const AdminDashboardPage = lazy(() =>
  import('./pages/AdminDashboardPage').then((module) => ({
    default:
      module.AdminDashboardPage ??
      (module as ModuleWithOptionalDefault).default ??
      (() => null),
  })),
);
const AdminLoginPage = lazy(() =>
  import('./pages/AdminLoginPage').then((module) => ({
    default:
      module.AdminLoginPage ??
      (module as ModuleWithOptionalDefault).default ??
      (() => null),
  })),
);
const AdminHubPage = lazy(() =>
  import('./pages/AdminHubPage').then((module) => ({
    default:
      module.AdminHubPage ?? (module as ModuleWithOptionalDefault).default ?? (() => null),
  })),
);

function RouteLoader() {
  return <div className="min-h-screen bg-[#fcfcfc]" />;
}

function withSuspense(Component: ComponentType) {
  return function SuspendedRouteComponent() {
    return (
      <Suspense fallback={<RouteLoader />}>
        <Component />
      </Suspense>
    );
  };
}

function ScaledViewport({ children }: { children: ReactNode }) {
  const BASE_WIDTH = 1536;
  const BASE_HEIGHT = 864;
  const [scale, setScale] = useState(1);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsMobile(w < 1024);
      const s = Math.min(1, w / BASE_WIDTH, h / BASE_HEIGHT);
      setScale(Math.max(0.68, s));
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // On mobile: no scaling — native responsive CSS takes over
  // On desktop: scale to fit the design canvas consistently
  if (isMobile) {
    return (
      <div className="min-h-screen w-full overflow-x-hidden" style={{ background: '#fcfcfc' }}>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen overflow-x-hidden" style={{ background: '#fcfcfc' }}>
      <div
        style={{
          width: scale < 1 ? `${100 / scale}%` : '100%',
          transformOrigin: 'top left',
          transform: scale < 1 ? `scale(${scale})` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <ScaledViewport>
      <div className="min-h-screen bg-[#fcfcfc] selection:bg-orange-500 selection:text-white">
        <Outlet />
      </div>
    </ScaledViewport>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: withSuspense(LandingPage),
});

// --- PARTICIPANT ROUTES ---
const participantBaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/r/$roomId',
  component: withSuspense(ParticipantLayout),
});

const participantRequestRoute = createRoute({
  getParentRoute: () => participantBaseRoute,
  path: '/request',
  component: withSuspense(ParticipantPage),
});

const participantIndexRoute = createRoute({
  getParentRoute: () => participantBaseRoute,
  path: '/',
  component: withSuspense(MusicRoom),
});

// --- ADMIN ROUTES ---
const adminLoginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/login',
  component: withSuspense(AdminLoginPage),
});

const adminHubRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: withSuspense(AdminHubPage),
});

const adminRoomRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/admin/$roomId',
  component: withSuspense(AdminDashboardPage),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  participantBaseRoute.addChildren([participantIndexRoute, participantRequestRoute]),
  adminLoginRoute,
  adminHubRoute,
  adminRoomRoute,
]);

const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
