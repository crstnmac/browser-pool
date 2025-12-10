import { Camera, TrendingUp, Zap, Clock } from 'lucide-react'
import { useUser, useUsage, useScreenshots } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'

export function DashboardPage() {
  const { data: user } = useUser()
  const { data: usage } = useUsage()
  const { data: screenshots } = useScreenshots(1, 5)
  const navigate = useNavigate()

  const usagePercentage = usage?.currentPeriod
    ? (usage.currentPeriod.screenshotsUsed / usage.currentPeriod.screenshotsLimit) * 100
    : 0

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-4xl md:text-5xl font-normal tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-lg">
          Welcome back, {user?.name || 'User'}!
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Current Plan</CardTitle>
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">{user?.plan}</div>
            <p className="text-sm text-muted-foreground mt-1">
              {user?.subscriptionStatus || 'Active'}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Screenshots Used</CardTitle>
            <Camera className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {usage?.currentPeriod?.screenshotsUsed || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              of {usage?.currentPeriod?.screenshotsLimit || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Total API Calls</CardTitle>
            <Zap className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {usage?.total?.totalApiCalls || 0}
            </div>
            <p className="text-sm text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-base font-medium text-muted-foreground">Resets In</CardTitle>
            <Clock className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-foreground">
              {usage?.currentPeriod?.resetDate
                ? format(new Date(usage.currentPeriod.resetDate), 'd')
                : '30'}
            </div>
            <p className="text-sm text-muted-foreground mt-1">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage Progress */}
      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-semibold">Monthly Usage</CardTitle>
          <CardDescription className="text-base">
            Your screenshot quota for this billing period
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-base">
            <span className="text-foreground">
              {usage?.currentPeriod?.screenshotsUsed || 0} / {usage?.currentPeriod?.screenshotsLimit || 0} screenshots
            </span>
            <span className="text-muted-foreground font-medium">
              {usagePercentage.toFixed(1)}%
            </span>
          </div>
          <Progress value={usagePercentage} className="h-2" />
          {usagePercentage > 80 && (
            <p className="text-base text-muted-foreground">
              You're running low on screenshots. Consider upgrading your plan.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Screenshots */}
      <Card className="border-border/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-semibold">Recent Screenshots</CardTitle>
              <CardDescription className="text-base">Your latest captured screenshots</CardDescription>
            </div>
            <Button variant="outline" className="h-10" onClick={() => navigate('/screenshots')}>View All</Button>
          </div>
        </CardHeader>
        <CardContent>
          {screenshots && screenshots.screenshots.length > 0 ? (
            <div className="space-y-3">
              {screenshots.screenshots.map((screenshot) => (
                <div
                  key={screenshot.id}
                  className="flex items-center justify-between border border-border/40 rounded-lg p-4 hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/screenshots/${screenshot.id}`)}
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={screenshot.url}
                      alt="Screenshot"
                      className="h-16 w-24 object-cover rounded border border-border/40"
                    />
                    <div className="space-y-1">
                      <p className="font-medium text-base text-foreground">{screenshot.fullUrl}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-sm">
                          {screenshot.width}x{screenshot.height}
                        </Badge>
                        <Badge variant="secondary" className="text-sm">{screenshot.format}</Badge>
                        {screenshot.cookiesHandled && (
                          <Badge variant="outline" className="text-sm">Cookies handled</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-base text-muted-foreground hidden md:block">
                    {format(new Date(screenshot.createdAt), 'PPp')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <Camera className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No screenshots yet</h3>
              <p className="text-muted-foreground text-base mb-6">
                Get started by capturing your first screenshot
              </p>
              <Button onClick={() => navigate('/screenshots')}>
                Create Screenshot
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
