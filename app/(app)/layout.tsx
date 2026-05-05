import { AuthProvider } from '@/lib/auth-context'
import { PageLoadingProvider } from '@/lib/page-loading-context'
import { AppShell } from '@/components/app-shell'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PageLoadingProvider>
        <AppShell>
          {children}
        </AppShell>
      </PageLoadingProvider>
    </AuthProvider>
  )
}
