'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import type { Tag } from '@/lib/types'

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e'
]

export default function TagsSettingsPage() {
  const { profile } = useAuth()
  const [tags, setTags] = useState<Tag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)
  const [tagName, setTagName] = useState('')
  const [tagColor, setTagColor] = useState(COLORS[0])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchTags = async () => {
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name')
    if (data) setTags(data)
    setIsLoading(false)
  }

  const handleOpenDialog = (tag?: Tag) => {
    if (tag) {
      setEditingTag(tag)
      setTagName(tag.name)
      setTagColor(tag.color)
    } else {
      setEditingTag(null)
      setTagName('')
      setTagColor(COLORS[Math.floor(Math.random() * COLORS.length)])
    }
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!tagName.trim()) {
      toast.error('Please enter a tag name')
      return
    }

    setIsSubmitting(true)

    if (editingTag) {
      const { error } = await supabase
        .from('tags')
        .update({ name: tagName.trim(), color: tagColor })
        .eq('id', editingTag.id)

      if (error) {
        toast.error('Failed to update tag')
        setIsSubmitting(false)
        return
      }
      toast.success('Tag updated')
    } else {
      const { error } = await supabase
        .from('tags')
        .insert({ name: tagName.trim(), color: tagColor, created_by: profile?.id })

      if (error) {
        toast.error('Failed to create tag')
        setIsSubmitting(false)
        return
      }
      toast.success('Tag created')
    }

    setIsSubmitting(false)
    setDialogOpen(false)
    fetchTags()
  }

  const handleDeleteTag = async (tagId: string) => {
    if (!confirm('Are you sure you want to delete this tag?')) return

    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)

    if (error) {
      toast.error('Failed to delete tag')
      return
    }

    toast.success('Tag deleted')
    fetchTags()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Tags</CardTitle>
            <CardDescription>Create tags to organize inspiration</CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus />
                Add Tag
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTag ? 'Edit Tag' : 'Create Tag'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="tagName">Tag Name</Label>
                  <Input
                    id="tagName"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    placeholder="UI Design"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setTagColor(color)}
                        className={`w-8 h-8 rounded-full transition-transform ${
                          tagColor === color ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="pt-2">
                  <Label>Preview</Label>
                  <div className="mt-2">
                    <span 
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm border"
                      style={{ borderColor: tagColor }}
                    >
                      <span 
                        className="w-2 h-2 rounded-full mr-2" 
                        style={{ backgroundColor: tagColor }} 
                      />
                      {tagName || 'Tag Name'}
                    </span>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : editingTag ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No tags yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create tags to organize inspiration posts</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <span 
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm border"
                        style={{ borderColor: tag.color }}
                      >
                        <span 
                          className="w-2 h-2 rounded-full mr-2" 
                          style={{ backgroundColor: tag.color }} 
                        />
                        {tag.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(tag.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(tag)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="text-destructive"
                          onClick={() => handleDeleteTag(tag.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
