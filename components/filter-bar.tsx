'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Grid2X2, Grid3X3, LayoutGrid, Filter, Bookmark, Plus } from 'lucide-react'
import { toast } from 'sonner'
import type { Tag, Team, SavedView, SortOrder, ContentType } from '@/lib/types'
import { cn } from '@/lib/utils'

interface FilterBarProps {
  order: SortOrder
  onOrderChange: (order: SortOrder) => void
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  selectedTeam: string | null
  onTeamChange: (team: string | null) => void
  selectedTypes: ContentType[]
  onTypesChange: (types: ContentType[]) => void
  columns: number
  onColumnsChange: (cols: number) => void
  tags: Tag[]
  teams: Team[]
  savedViews: SavedView[]
  onSaveView: (name: string) => void
  onLoadView: (view: SavedView) => void
}

export function FilterBar({
  order,
  onOrderChange,
  selectedTags,
  onTagsChange,
  selectedTeam,
  onTeamChange,
  selectedTypes,
  onTypesChange,
  columns,
  onColumnsChange,
  tags,
  teams,
  savedViews,
  onSaveView,
  onLoadView
}: FilterBarProps) {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [viewName, setViewName] = useState('')

  const handleTagToggle = (tagId: string) => {
    if (selectedTags.includes(tagId)) {
      onTagsChange(selectedTags.filter(t => t !== tagId))
    } else {
      onTagsChange([...selectedTags, tagId])
    }
  }

  const handleTypeToggle = (type: ContentType) => {
    if (selectedTypes.includes(type)) {
      onTypesChange(selectedTypes.filter(t => t !== type))
    } else {
      onTypesChange([...selectedTypes, type])
    }
  }

  const handleSaveView = () => {
    if (!viewName.trim()) {
      toast.error('Please enter a name for the view')
      return
    }
    onSaveView(viewName.trim())
    setViewName('')
    setSaveDialogOpen(false)
  }

  const hasActiveFilters = selectedTags.length > 0 || selectedTeam || selectedTypes.length > 0

  return (
    <div className="flex flex-wrap items-center gap-2 py-4">
      <Select value={order} onValueChange={(v) => onOrderChange(v as SortOrder)}>
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="newest">Newest</SelectItem>
          <SelectItem value="oldest">Oldest</SelectItem>
          <SelectItem value="most_views">Most Views</SelectItem>
        </SelectContent>
      </Select>

      {teams.length > 0 && (
        <Select value={selectedTeam ?? 'all'} onValueChange={(v) => onTeamChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="All Teams" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teams</SelectItem>
            {teams.map((team) => (
              <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn("h-9", hasActiveFilters && "border-foreground")}>
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 text-xs bg-foreground text-background rounded-full w-5 h-5 flex items-center justify-center">
                {selectedTags.length + (selectedTeam ? 1 : 0) + selectedTypes.length}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Content Type</DropdownMenuLabel>
          <DropdownMenuCheckboxItem 
            checked={selectedTypes.includes('url')}
            onCheckedChange={() => handleTypeToggle('url')}
          >
            Links
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem 
            checked={selectedTypes.includes('image')}
            onCheckedChange={() => handleTypeToggle('image')}
          >
            Images
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem 
            checked={selectedTypes.includes('video')}
            onCheckedChange={() => handleTypeToggle('video')}
          >
            Videos
          </DropdownMenuCheckboxItem>

          {tags.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Tags</DropdownMenuLabel>
              {tags.map((tag) => (
                <DropdownMenuCheckboxItem 
                  key={tag.id}
                  checked={selectedTags.includes(tag.id)}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                >
                  <span 
                    className="w-2 h-2 rounded-full mr-2" 
                    style={{ backgroundColor: tag.color }} 
                  />
                  {tag.name}
                </DropdownMenuCheckboxItem>
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {savedViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Bookmark className="w-4 h-4 mr-2" />
              Views
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {savedViews.map((view) => (
              <DropdownMenuCheckboxItem 
                key={view.id}
                onCheckedChange={() => onLoadView(view)}
              >
                {view.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="h-9">
            <Plus className="w-4 h-4 mr-2" />
            Save View
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Current View</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="viewName">View Name</Label>
              <Input 
                id="viewName"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="My Custom View"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveView}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="ml-auto flex items-center gap-1 border rounded-md p-0.5">
        <button
          onClick={() => onColumnsChange(2)}
          className={cn(
            "p-1.5 rounded transition-colors",
            columns === 2 ? "bg-secondary" : "hover:bg-secondary/50"
          )}
        >
          <Grid2X2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onColumnsChange(3)}
          className={cn(
            "p-1.5 rounded transition-colors",
            columns === 3 ? "bg-secondary" : "hover:bg-secondary/50"
          )}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        <button
          onClick={() => onColumnsChange(4)}
          className={cn(
            "p-1.5 rounded transition-colors",
            columns === 4 ? "bg-secondary" : "hover:bg-secondary/50"
          )}
        >
          <LayoutGrid className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
