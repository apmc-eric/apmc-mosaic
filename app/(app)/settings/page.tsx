'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Upload, X, Sparkles, Plus } from 'lucide-react'
import { toast } from 'sonner'

const supabase = createClient()

// Default whitelisted domains
const DEFAULT_DOMAINS = ['aparentmedia.com', 'kidoodle.tv']

export default function GeneralSettingsPage() {
  const { refreshSettings } = useAuth()
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [domains, setDomains] = useState<string[]>(DEFAULT_DOMAINS)
  const [newDomain, setNewDomain] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load settings from key-value store
  useEffect(() => {
    const loadSettings = async () => {
      const { data } = await supabase.from('settings').select('*')
      if (data) {
        data.forEach(row => {
          if (row.key === 'logo_url' && row.value) {
            setLogoUrl(typeof row.value === 'string' ? row.value : null)
          }
          if (row.key === 'allowed_domains' && Array.isArray(row.value)) {
            setDomains(row.value.length > 0 ? row.value : DEFAULT_DOMAINS)
          }
        })
      }
      setIsLoading(false)
    }
    loadSettings()
  }, [])

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 1024 * 1024) {
      toast.error('File too large', { description: 'Maximum size is 1MB' })
      return
    }

    // Validate image dimensions
    const img = new window.Image()
    img.src = URL.createObjectURL(file)
    
    const isValidSize = await new Promise<boolean>((resolve) => {
      img.onload = () => {
        URL.revokeObjectURL(img.src)
        if (img.width < 180 || img.height < 180) {
          toast.error('Image too small', { description: 'Minimum size is 180x180px' })
          resolve(false)
          return
        }
        if (Math.abs(img.width - img.height) > 10) {
          toast.error('Invalid aspect ratio', { description: 'Logo must be 1:1 ratio (square)' })
          resolve(false)
          return
        }
        resolve(true)
      }
      img.onerror = () => {
        URL.revokeObjectURL(img.src)
        resolve(false)
      }
    })

    if (!isValidSize) return

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
      setLogoUrl(pathname)
      toast.success('Logo uploaded')
    } catch {
      toast.error('Failed to upload logo')
    } finally {
      setIsUploading(false)
    }
  }

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
    setDomains(domains.filter(d => d !== domain))
  }

  const handleSave = async () => {
    if (domains.length === 0) {
      toast.error('At least one domain is required')
      return
    }

    setIsSaving(true)

    // Upsert settings as key-value pairs
    const updates = [
      { key: 'logo_url', value: logoUrl },
      { key: 'allowed_domains', value: domains }
    ]

    for (const update of updates) {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          key: update.key, 
          value: update.value,
          updated_at: new Date().toISOString()
        }, { onConflict: 'key' })

      if (error) {
        console.error('Save error:', error)
        setIsSaving(false)
        toast.error('Failed to save settings')
        return
      }
    }

    setIsSaving(false)
    await refreshSettings()
    toast.success('Settings saved')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Customize the look of your Mosaic</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Logo (min 180x180px, 1:1 ratio)</Label>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg border border-border flex items-center justify-center bg-muted">
                {logoUrl ? (
                  <img 
                    src={`/api/file?pathname=${encodeURIComponent(logoUrl)}`}
                    alt="Logo"
                    className="w-8 h-8 object-contain"
                  />
                ) : (
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
                {logoUrl && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setLogoUrl(null)}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Allowed Email Domains</CardTitle>
          <CardDescription>Only users with these email domains can sign up</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="example.com"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddDomain())}
            />
            <Button onClick={handleAddDomain} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add
            </Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {domains.map((domain) => (
              <div 
                key={domain}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-secondary text-sm"
              >
                {domain}
                <button 
                  onClick={() => handleRemoveDomain(domain)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  )
}
