'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

// Default whitelisted domains
const DEFAULT_DOMAINS = ['aparentmedia.com', 'kidoodle.tv']

export default function GeneralSettingsPage() {
  const { refreshSettings } = useAuth()
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS)
  const [newDomain, setNewDomain] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Load settings from key-value store (logo_url remains in DB; not editable in UI)
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*')
      if (data) {
        data.forEach((row) => {
          if (row.key === 'allowed_domains' && Array.isArray(row.value)) {
            setDomains(row.value.length > 0 ? row.value : DEFAULT_DOMAINS)
          }
        })
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [])

  const handleAddDomain = () => {
    const domain = newDomain.trim().toLowerCase()
    if (!domain) return
    if (domains.includes(domain)) {
      toast.error('Domain already added')
      return
    }
    if (!/^[a-z0-9][a-z0-9-]*\.[a-z]{2,}$/i.test(domain)) {
      toast.error('Invalid domain format')
      return
    }
    setDomains([...domains, domain])
    setNewDomain('')
  }

  const handleRemoveDomain = (domain: string) => {
    setDomains(domains.filter((d) => d !== domain))
  }

  const handleSave = async () => {
    if (domains.length === 0) {
      toast.error('At least one domain is required')
      return
    }

    setIsSaving(true)

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'allowed_domains',
          value: domains,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'key' },
      )

    if (error) {
      console.error('Save error:', error)
      setIsSaving(false)
      toast.error('Failed to save settings')
      return
    }

    setIsSaving(false)
    await refreshSettings()
    toast.success('Settings saved')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Allowed Email Domains</CardTitle>
          <CardDescription>Only users with these email domains can sign up</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="example.com"
                  onKeyDown={(e) =>
                    e.key === 'Enter' && (e.preventDefault(), handleAddDomain())
                  }
                />
                <Button onClick={handleAddDomain} variant="outline">
                  <Plus />
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {domains.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {domain}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemoveDomain(domain)}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${domain}`}
                    >
                      <X className="!size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
