'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { useEffect } from 'react'
import { Settings, Users, Tag, Layers, FolderKanban, ListOrdered, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

const settingsNav = [
  { href: '/settings', label: 'General', icon: Settings },
  { href: '/settings/teams', label: 'Teams', icon: Layers },
  { href: '/settings/mosaic/projects', label: 'Projects', icon: FolderKanban },
  { href: '/settings/mosaic/categories', label: 'Categories', icon: Tag },
  { href: '/settings/mosaic/phases', label: 'Phase labels', icon: ListOrdered },
  { href: '/settings/users', label: 'Users', icon: Users },
  { href: '/settings/mosaic/domains', label: 'Domains', icon: Globe },
  { href: '/settings/tags', label: 'Tags (legacy)', icon: Tag },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.push('/works')
    }
  }, [isAdmin, isLoading, router])

  if (!isAdmin) {
    return null
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-8">
        <h1 className="text-3xl font-serif">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your Mosaic workspace</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <nav className="md:w-48 shrink-0">
          <ul className="flex md:flex-col gap-1">
            {settingsNav.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                      isActive 
                        ? "bg-secondary text-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0">
          {children}
        </div>
      </div>
    </div>
  )
}
