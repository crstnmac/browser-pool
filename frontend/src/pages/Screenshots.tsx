import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Camera, Download, Trash2, Plus } from 'lucide-react'
import { useScreenshots, useCreateScreenshot, useDeleteScreenshot } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { format } from 'date-fns'

const screenshotSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  fullPage: z.boolean(),
  width: z.number().min(320).max(3840),
  height: z.number().min(320).max(3840),
})

type ScreenshotFormData = z.infer<typeof screenshotSchema>

export function ScreenshotsPage() {
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const { data: screenshotsData, isLoading } = useScreenshots(page, 12)
  const createMutation = useCreateScreenshot()
  const deleteMutation = useDeleteScreenshot()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScreenshotFormData>({
    resolver: zodResolver(screenshotSchema),
    defaultValues: {
      url: '',
      fullPage: true,
      width: 1920,
      height: 1080,
    },
  })

  const onSubmit = async (data: ScreenshotFormData) => {
    await createMutation.mutateAsync({
      url: data.url,
      fullPage: data.fullPage,
      width: data.width,
      height: data.height,
      handleCookies: true,
      blockPopups: true,
    })
    setIsDialogOpen(false)
    reset()
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this screenshot?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Screenshots</h1>
          <p className="text-muted-foreground">
            Manage and view your captured screenshots
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Screenshot
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit(onSubmit)}>
              <DialogHeader>
                <DialogTitle>Capture Screenshot</DialogTitle>
                <DialogDescription>
                  Enter the URL and configuration for your screenshot
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="url">Website URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com"
                    {...register('url')}
                  />
                  {errors.url && (
                    <p className="text-sm text-destructive">{errors.url.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="width">Width</Label>
                    <Input
                      id="width"
                      type="number"
                      {...register('width', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">Height</Label>
                    <Input
                      id="height"
                      type="number"
                      {...register('height', { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Capturing...' : 'Capture Screenshot'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
        </div>
      ) : screenshotsData && screenshotsData.screenshots.length > 0 ? (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {screenshotsData.screenshots.map((screenshot) => (
              <Card key={screenshot.id} className="overflow-hidden">
                <div className="aspect-video w-full overflow-hidden bg-muted">
                  <img
                    src={screenshot.url}
                    alt="Screenshot"
                    className="h-full w-full object-cover"
                  />
                </div>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base truncate">
                    {screenshot.fullUrl}
                  </CardTitle>
                  <CardDescription>
                    {format(new Date(screenshot.createdAt), 'PPp')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">
                      {screenshot.width}x{screenshot.height}
                    </Badge>
                    <Badge variant="secondary">{screenshot.format}</Badge>
                    {screenshot.cookiesHandled && (
                      <Badge variant="outline">Cookies</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      asChild
                    >
                      <a href={screenshot.url} download target="_blank" rel="noopener noreferrer">
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(screenshot.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {screenshotsData.pages}
            </span>
            <Button
              variant="outline"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= screenshotsData.pages}
            >
              Next
            </Button>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Camera className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No screenshots yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start capturing screenshots by clicking the button above
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
