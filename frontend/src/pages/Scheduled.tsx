import { Calendar } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function ScheduledPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-3xl md:text-4xl font-normal tracking-tight">Scheduled Screenshots</h1>
        <p className="text-muted-foreground text-base">
          Automate screenshot capture with scheduled tasks
        </p>
      </div>
      <Card className="border-border/40">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">Scheduled Screenshots</h3>
          <p className="text-muted-foreground text-center text-sm">
            Scheduled screenshot management coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
