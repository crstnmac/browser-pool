import { Webhook } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function WebhooksPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-3xl md:text-4xl font-normal tracking-tight">Webhooks</h1>
        <p className="text-muted-foreground text-base">
          Configure webhooks to receive real-time notifications
        </p>
      </div>
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Webhooks Management</h3>
          <p className="text-muted-foreground text-center text-sm">
            Webhook management interface coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
