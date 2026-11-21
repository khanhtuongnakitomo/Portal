import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { StoreProvider, useStore } from '@/lib/store'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { AccessDenied, ConnectionStatus, Footer, Toasts, homeFor, routeRole, useHashRoute, type Route } from '@/components/Shell'
import { AuthScreen } from '@/components/AuthScreen'
import { StudentView } from '@/student/StudentView'
import { ManagerView } from '@/manager/ManagerView'
import { AdminView } from '@/admin/AdminView'
import { ProfileView } from '@/components/ProfileView'
import { AuroraBackdrop, CursorField } from '@/components/effects'
import { canAccessRoute } from '@/lib/permissions'

let LocalDevPanel: ComponentType<{ go: (route: Route) => void }> | undefined
if (import.meta.env.DEV) {
  if (['localhost', '127.0.0.1', '[::1]', '::1'].includes(window.location.hostname)) {
    LocalDevPanel = lazy(() => import('@/dev/DevPanel'))
  }
}

function Router() {
  const { currentUser, sessionRecovery } = useStore()
  const [route, go] = useHashRoute()
  const { t, locale } = useI18n()
  useEffect(() => {
    document.title = t('common.appName')
    document.documentElement.lang = locale
  }, [locale, t])

  // Guard: unauthenticated users go to /auth; authenticated users leave /auth.
  useEffect(() => {
    if (sessionRecovery) return
    if (!currentUser && route !== '/auth') go('/auth')
    if (currentUser && route === '/auth') go(homeFor(currentUser.role))
  }, [currentUser, route, go, sessionRecovery])

  let page
  if (sessionRecovery) page = null
  else if (!currentUser || route === '/auth') page = <AuthScreen />
  else if (!canAccessRoute(route, currentUser.role)) page = <AccessDenied need={routeRole[route]!} go={go} />
  else if (route === '/profile') page = <ProfileView go={go} />
  else if (route === '/student') page = <StudentView />
  else if (route === '/manager') page = <ManagerView />
  else page = <AdminView />

  return (
    <div className="flex min-h-screen flex-col">
      <AuroraBackdrop />
      <ConnectionStatus go={go} />
      <div key={currentUser?.id ?? 'signed-out'} className="flex-1">{page}</div>
      {currentUser && <Footer />}
      <Toasts />
      <CursorField />
      {import.meta.env.DEV && LocalDevPanel && (
        <Suspense fallback={null}>
          <LocalDevPanel go={go} />
        </Suspense>
      )}
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <StoreProvider>
        <Router />
      </StoreProvider>
    </I18nProvider>
  )
}
