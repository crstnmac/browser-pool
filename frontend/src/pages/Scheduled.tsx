import { Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ScheduledPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scheduled Screenshots</h1>
        <p className="text-muted-foreground">
          Automate screenshot capture with scheduled tasks
        </p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Scheduled Screenshots</h3>
          <p className="text-muted-foreground text-center">
            Scheduled screenshot management coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
