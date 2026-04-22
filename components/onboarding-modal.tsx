'use client'

import { useMemo, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProfileImage } from '@/components/profile-image'
import { User, Upload } from 'lucide-react'
import { toast } from 'sonner'
import type { Team, Profile } from '@/lib/types'
import { defaultProfileTimeZone, PROFILE_TIMEZONE_CHOICES } from '@/lib/timezone-choices'

const supabase = createClient()

interface OnboardingModalProps {
  open: boolean
  teams: Team[]
  profile: Profile | null
  onComplete: () => void
}

export function OnboardingModal({ open, teams, profile, onComplete }: OnboardingModalProps) {
  const timeZoneChoices = useMemo(() => {
    const b = defaultProfileTimeZone()
    const list = [...PROFILE_TIMEZONE_CHOICES]
    if (!list.some((x) => x.value === b)) {
      list.unshift({ value: b, label: `${b.replace(/_/g, ' ')} (this device)` })
    }
    return list
  }, [])

  const [firstName, setFirstName] = useState(profile?.first_name ?? '')
  const [lastName, setLastName] = useState(profile?.last_name ?? '')
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [timeZone, setTimeZone] = useState(() => defaultProfileTimeZone())
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum size is 1MB' })
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('Upload failed')

      const { pathname } = await response.json()
      setAvatarUrl(pathname)
      toast.success('Avatar uploaded')
    } catch {
      toast.error('Failed to upload avatar')
    } finally {
      setIsUploading(false)
    }
  }

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstName.trim() || !lastName.trim()) {
      toast.error('Please fill in your name')
      return
    }

    setIsSubmitting(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      toast.error('Not authenticated')
      setIsSubmitting(false)
      return
    }

    // Update profile
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        avatar_url: avatarUrl,
        timezone: timeZone.trim() || defaultProfileTimeZone(),
        onboarding_complete: true,
      })
      .eq('id', user.id)

    if (profileError) {
      toast.error('Failed to save profile', { description: profileError.message })
      setIsSubmitting(false)
      return
    }

    // Add team memberships
    if (selectedTeamIds.length > 0) {
      const { error: teamError } = await supabase
        .from('user_teams')
        .insert(selectedTeamIds.map(team_id => ({ user_id: user.id, team_id })))

      if (teamError) {
        console.error('Team assignment error:', teamError)
      }
    }

    setIsSubmitting(false)
    toast.success('Welcome to Mosaic!')
    onComplete()
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif">Welcome to Mosaic</DialogTitle>
          <DialogDescription>
            Let&apos;s set up your profile to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="flex flex-col items-center gap-4">
            <ProfileImage
              pathname={avatarUrl}
              alt="Your profile photo"
              size="2xl"
              className="border-2 border-border"
              fallbackClassName="bg-muted"
              fallback={<User className="size-8 text-muted-foreground" aria-hidden />}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <Button 
              type="button" 
              variant="outline" 
              size="small"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload Photo'}
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="mosaic-tz">Time zone</Label>
            <p className="text-muted-foreground text-xs leading-snug">
              Used for checkpoint times and calendar labels. You can change this later in account settings.
            </p>
            <Select value={timeZone} onValueChange={setTimeZone}>
              <SelectTrigger id="mosaic-tz" className="w-full">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                required
              />
            </div>
          </div>

          {teams.length > 0 && (
            <div className="space-y-3">
              <Label>Teams (Optional)</Label>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`team-${team.id}`}
                      checked={selectedTeamIds.includes(team.id)}
                      onCheckedChange={() => toggleTeam(team.id)}
                    />
                    <label
                      htmlFor={`team-${team.id}`}
                      className="text-sm cursor-pointer"
                    >
                      {team.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Get Started'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
