import { useEffect } from 'react'
import { StoreProvider, useStore } from '@/lib/store'
import { I18nProvider, useI18n } from '@/lib/i18n'
import { AccessDenied, Footer, RoleSwitcher, Toasts, homeFor, routeRole, useHashRoute } from '@/components/Shell'
import { AuthScreen } from '@/components/AuthScreen'
import { StudentView } from '@/student/StudentView'
import { ManagerView } from '@/manager/ManagerView'
import { AdminView } from '@/admin/AdminView'
import { ProfileView } from '@/components/ProfileView'
import { AuroraBackdrop, CursorField } from '@/components/effects'

function Router() {
  const { currentUser } = useStore()
  const [route, go] = useHashRoute()
  const { locale } = useI18n()

  // Ensure document title is set
  useEffect(() => {
    document.title =
      locale === 'vi'
        ? 'Hệ thống đặt phòng dành cho TNE - UTS'
        : 'Room Booking System for TNE - UTS'
  }, [locale])

  // Guard: unauthenticated users go to /auth; authenticated users leave /auth.
  useEffect(() => {
    if (!currentUser && route !== '/auth') go('/auth')
    if (currentUser && route === '/auth') go(homeFor(currentUser.role))
  }, [currentUser, route, go])

  let page
  if (!currentUser || route === '/auth') page = <AuthScreen go={go} />
  else if (route === '/profile') page = <ProfileView go={go} />
  else if (routeRole[route] && routeRole[route] !== currentUser.role) page = <AccessDenied need={routeRole[route]!} go={go} />
  else if (route === '/student') page = <StudentView />
  else if (route === '/manager') page = <ManagerView />
  else page = <AdminView />

  return (
    <div className="flex min-h-screen flex-col">
      <AuroraBackdrop />
      <RoleSwitcher go={go} />
      <div className="flex-1">{page}</div>
      {currentUser && <Footer />}
      <Toasts />
      <CursorField />
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <I18nProvider>
        <Router />
      </I18nProvider>
    </StoreProvider>
  )
}
