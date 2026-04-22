'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, X, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { defaultProfileTimeZone, PROFILE_TIMEZONE_CHOICES } from '@/lib/timezone-choices'
import type { MosaicRole, AllowedUserEntry } from '@/lib/types'
import { mosaicRoleLabel } from '@/lib/mosaic-role-label'
import { DEFAULT_COMPANY_ALIAS_DOMAINS } from '@/lib/company-email-alias'

const supabase = createClient()

const ASSIGNABLE_ROLES: MosaicRole[] = ['admin', 'designer', 'collaborator', 'guest']
const DISPLAY_DOMAIN = DEFAULT_COMPANY_ALIAS_DOMAINS[0]

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function GeneralSettingsPage() {
  const { user, profile, isAdmin, hasGoogleToken, refreshSettings, refreshGoogleConnection, refreshProfile, viewRole, saveDemoViewRole } = useAuth()
  const [allowedEmails, setAllowedEmails] = useState<AllowedUserEntry[]>([])
  const [newFirst, setNewFirst] = useState('')
  const [newLast, setNewLast] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newRole, setNewRole] = useState<MosaicRole>('designer')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false)
  const [profileTimeZone, setProfileTimeZone] = useState(() => defaultProfileTimeZone())
  const [savingTz, setSavingTz] = useState(false)

  const timeZoneChoices = useMemo(() => {
    const b = defaultProfileTimeZone()
    const list = [...PROFILE_TIMEZONE_CHOICES]
    if (!list.some((x) => x.value === b)) {
      list.unshift({ value: b, label: `${b.replace(/_/g, ' ')} (this device)` })
    }
    return list
  }, [])

  useEffect(() => {
    if (profile?.timezone?.trim()) setProfileTimeZone(profile.timezone.trim())
  }, [profile?.timezone])

  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*')
      if (data) {
        data.forEach((row) => {
          if (row.key === 'allowed_emails' && Array.isArray(row.value)) {
            setAllowedEmails(row.value)
          }
        })
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [])

  const handleAddUser = () => {
    const username = newUsername.trim().toLowerCase().replace(/@.*/, '')
    const first = newFirst.trim()
    const last = newLast.trim()
    if (!username || !first || !last) {
      toast.error('First name, last name, and username are required')
      return
    }
    if (allowedEmails.some((e) => e.username === username)) {
      toast.error('Username already added')
      return
    }
    setAllowedEmails([...allowedEmails, { username, first_name: first, last_name: last, role: newRole }])
    setNewFirst('')
    setNewLast('')
    setNewUsername('')
    setNewRole('designer')
  }

  const handleRemoveUser = (username: string) => {
    setAllowedEmails(allowedEmails.filter((e) => e.username !== username))
  }

  const handleUpdateRole = (username: string, role: MosaicRole) => {
    setAllowedEmails(allowedEmails.map((e) => (e.username === username ? { ...e, role } : e)))
  }

  const handleSave = async () => {
    setIsSaving(true)

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          key: 'allowed_emails',
          value: allowedEmails,
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

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
        scopes: 'https://www.googleapis.com/auth/calendar',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    })
    if (error) {
      toast.error('Could not connect Google Calendar', { description: error.message })
      setConnectingGoogle(false)
    }
  }

  const handleSaveTimeZone = async () => {
    if (!user?.id) return
    setSavingTz(true)
    const tz = profileTimeZone.trim() || defaultProfileTimeZone()
    const { error } = await supabase.from('profiles').update({ timezone: tz, updated_at: new Date().toISOString() }).eq('id', user.id)
    setSavingTz(false)
    if (error) {
      toast.error('Could not save time zone', { description: error.message })
      return
    }
    await refreshProfile()
    toast.success('Time zone saved')
  }

  const handleDisconnectGoogle = async () => {
    if (!user) return
    setDisconnectingGoogle(true)
    const { error } = await supabase
      .from('user_google_tokens')
      .delete()
      .eq('user_id', user.id)
    setDisconnectingGoogle(false)
    if (error) {
      toast.error('Could not disconnect Google Calendar')
      return
    }
    await refreshGoogleConnection()
    toast.success('Google Calendar disconnected')
  }

  return (
    <div className="space-y-6">
      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>Allowed Users</CardTitle>
            <CardDescription>
              Only these users can sign in. Both @{DISPLAY_DOMAIN} and @{DEFAULT_COMPANY_ALIAS_DOMAINS[1]} are accepted for each username. Role and name are applied automatically at first sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                  <Input
                    value={newFirst}
                    onChange={(e) => setNewFirst(e.target.value)}
                    placeholder="First name"
                  />
                  <Input
                    value={newLast}
                    onChange={(e) => setNewLast(e.target.value)}
                    placeholder="Last name"
                  />
                  <div className="flex items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.replace(/@.*/, '').toLowerCase())}
                      placeholder="username"
                      className="h-9 min-w-0 flex-1 bg-transparent pl-3 text-sm outline-none placeholder:text-muted-foreground"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddUser())}
                    />
                    <span className="select-none whitespace-nowrap pr-3 text-sm text-muted-foreground">
                      @{DISPLAY_DOMAIN}
                    </span>
                  </div>
                  <Select value={newRole} onValueChange={(v) => setNewRole(v as MosaicRole)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {mosaicRoleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddUser} variant="outline">
                    <Plus className="mr-1 size-4" />
                    Add
                  </Button>
                </div>

                {allowedEmails.length > 0 ? (
                  <div className="divide-y divide-border rounded-md border">
                    {allowedEmails.map(({ username, first_name, last_name, role }) => (
                      <div key={username} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{first_name} {last_name}</p>
                          <p className="truncate text-xs text-muted-foreground">{username}@{DISPLAY_DOMAIN}</p>
                        </div>
                        <Select
                          value={role}
                          onValueChange={(v) => handleUpdateRole(username, v as MosaicRole)}
                        >
                          <SelectTrigger className="h-7 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSIGNABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r} className="text-xs">
                                {mosaicRoleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRemoveUser(username)}
                          className="shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove ${username}`}
                        >
                          <X className="!size-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No users added yet. Fill in the form above to grant access.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {user ? (
        <Card>
          <CardHeader>
            <CardTitle>Your time zone</CardTitle>
            <CardDescription>
              Checkpoint times and labels use this zone. Requires the{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">profiles.timezone</code> column — run
              migrations if saving fails.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1 space-y-2">
              <Label htmlFor="settings-tz">IANA time zone</Label>
              <Select value={profileTimeZone} onValueChange={setProfileTimeZone}>
                <SelectTrigger id="settings-tz" className="w-full max-w-md">
                  <SelectValue placeholder="Select time zone" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {timeZoneChoices.map((z) => (
                    <SelectItem key={z.value} value={z.value}>
                      {z.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="button" variant="secondary" disabled={savingTz} onClick={() => void handleSaveTimeZone()}>
              {savingTz ? 'Saving…' : 'Save time zone'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
          <CardDescription>
            Connect your Google Calendar to enable smart checkpoint scheduling — find available
            times across all ticket assignees automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasGoogleToken ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Google Calendar connected
              </div>
              <Button
                variant="outline"
                size="small"
                onClick={handleDisconnectGoogle}
                disabled={disconnectingGoogle}
              >
                {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleConnectGoogle}
              disabled={connectingGoogle}
            >
              <GoogleIcon />
              {connectingGoogle ? 'Redirecting...' : 'Connect Google Calendar'}
            </Button>
          )}
        </CardContent>
      </Card>

      {isAdmin ? (
        <Card>
          <CardHeader>
            <CardTitle>View as User Type</CardTitle>
            <CardDescription>
              Preview the Works page as a different role. Only you see this — no data is changed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="settings-view-role">Viewing as</Label>
                <Select
                  value={viewRole ?? 'admin'}
                  onValueChange={(v) => saveDemoViewRole(v === 'admin' ? null : (v as 'designer' | 'collaborator' | 'guest'))}
                >
                  <SelectTrigger id="settings-view-role" className="w-full max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin (default)</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="collaborator">Collaborator</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {viewRole && viewRole !== 'admin' ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDemoViewRole(null)}
                >
                  Reset to Admin
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isAdmin ? (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving || isLoading}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
