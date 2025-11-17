import { Webhook } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function WebhooksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground">
          Configure webhooks to receive real-time notifications
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Webhooks Management</h3>
          <p className="text-muted-foreground text-center">
            Webhook management interface coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
