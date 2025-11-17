import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { toast } from 'sonner'

export function ApiKeysPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const { data: apiKeys } = useApiKeys()
  const createMutation = useCreateApiKey()
  const deleteMutation = useDeleteApiKey()

  const { register, handleSubmit, reset } = useForm<{ name: string }>()

  const onSubmit = async (data: { name: string }) => {
    const result = await createMutation.mutateAsync(data)
    setNewApiKey(result.apiKey)
    reset()
  }

  const handleCopy = async (key: string) => {
    await navigator.clipboard.writeText(key)
    setCopiedKey(key)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure? This action cannot be undone.')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for authentication
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newApiKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy this key now. You won't be able to see it again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="flex items-center gap-2">
                    <Input value={newApiKey} readOnly className="font-mono text-sm" />
                    <Button size="icon" onClick={() => handleCopy(newApiKey)}>
                      {copiedKey === newApiKey ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => {
                      setNewApiKey(null)
                      setIsDialogOpen(false)
                    }}
                  >
                    Done
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Give your API key a descriptive name
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Key Name</Label>
                    <Input
                      id="name"
                      placeholder="Production API Key"
                      {...register('name', { required: true })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Creating...' : 'Create Key'}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {apiKeys && apiKeys.length > 0 ? (
        <div className="grid gap-4">
          {apiKeys.map((key) => (
            <Card key={key.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">{key.name}</CardTitle>
                    <CardDescription className="font-mono mt-1">
                      {key.keyPrefix}...
                    </CardDescription>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDelete(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div>
                    Created: {format(new Date(key.createdAt), 'PPp')}
                  </div>
                  {key.lastUsed && (
                    <div>
                      Last used: {format(new Date(key.lastUsed), 'PPp')}
                    </div>
                  )}
                  {key.expiresAt ? (
                    <Badge variant="outline">
                      Expires: {format(new Date(key.expiresAt), 'PP')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Never expires</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No API keys yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first API key to start using the API
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
