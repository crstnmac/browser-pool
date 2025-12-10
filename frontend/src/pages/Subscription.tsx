import { Check, CreditCard } from 'lucide-react'
import { useSubscription, useSubscriptionPlans, useCreateCheckout, useCancelSubscription, useReactivateSubscription, usePayments } from '@/hooks/use-api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { format, isValid } from 'date-fns'

// Helper function to safely format dates
const safeFormatDate = (dateString: string | null | undefined, formatStr: string): string => {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  if (!isValid(date)) return 'Invalid date'
  return format(date, formatStr)
}

export function SubscriptionPage() {
  const { data: subscription } = useSubscription()
  const { data: plans, isLoading: plansLoading, error: plansError } = useSubscriptionPlans()
  const { data: payments } = usePayments()
  const createCheckoutMutation = useCreateCheckout()
  const cancelMutation = useCancelSubscription()
  const reactivateMutation = useReactivateSubscription()

  const handleUpgrade = async (planId: string) => {
    await createCheckoutMutation.mutateAsync(planId)
  }

  const handleCancel = async () => {
    if (confirm('Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.')) {
      await cancelMutation.mutateAsync()
    }
  }

  const handleReactivate = async () => {
    await reactivateMutation.mutateAsync()
  }

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="instrument-serif-regular text-3xl md:text-4xl font-normal tracking-tight">Subscription</h1>
        <p className="text-muted-foreground text-base">
          Manage your subscription and billing
        </p>
      </div>

      {/* Current Subscription */}
      {subscription && (
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Current Subscription</CardTitle>
            <CardDescription className="text-sm">Your active plan and billing information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-2xl font-semibold text-foreground">{subscription.plan}</h3>
                <p className="text-sm text-muted-foreground">
                  {subscription.status === 'active' ? 'Active subscription' : subscription.status}
                </p>
              </div>
              <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                {subscription.status}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-3 text-sm">
              {subscription.currentPeriodStart && subscription.currentPeriodEnd && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Current period:</span>
                  <span className="text-foreground font-medium">
                    {safeFormatDate(subscription.currentPeriodStart, 'PP')} -{' '}
                    {safeFormatDate(subscription.currentPeriodEnd, 'PP')}
                  </span>
                </div>
              )}
              {subscription.trialEnd && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Trial ends:</span>
                  <span className="text-foreground font-medium">{safeFormatDate(subscription.trialEnd, 'PP')}</span>
                </div>
              )}
              {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Cancels on:</span>
                  <span className="font-medium">{safeFormatDate(subscription.currentPeriodEnd, 'PP')}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              {subscription.cancelAtPeriodEnd ? (
                <Button onClick={handleReactivate} disabled={reactivateMutation.isPending} className="h-10">
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate Subscription'}
                </Button>
              ) : (
                <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending} className="h-10">
                  {cancelMutation.isPending ? 'Canceling...' : 'Cancel Subscription'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Plans */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight">Available Plans</h2>
        </div>
        {plansLoading && (
          <div className="text-center py-12 text-muted-foreground">Loading plans...</div>
        )}
        {plansError && (
          <div className="text-center py-12 text-destructive">Failed to load plans. Please try again later.</div>
        )}
        {!plansLoading && !plansError && Array.isArray(plans) && plans.length > 0 && (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
            <Card key={plan.name} className={plan.name === subscription?.plan ? 'border-foreground/20 shadow-lg' : 'border-border/40'}>
              <CardHeader className="pb-6">
                <CardTitle className="text-xl font-semibold">{plan.displayName}</CardTitle>
                <CardDescription className="text-base mt-2">
                  <span className="text-3xl font-semibold text-foreground">${plan.price}</span>
                  <span className="text-muted-foreground ml-1">/{plan.interval}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {plan.features.screenshotsPerMonth.toLocaleString()} screenshots/month
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">
                      {plan.features.rateLimit} req/min
                    </span>
                  </li>
                  {plan.features.webhooks && (
                    <li className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Webhooks</span>
                    </li>
                  )}
                  {plan.features.scheduledScreenshots && (
                    <li className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Scheduled Screenshots</span>
                    </li>
                  )}
                  {plan.features.priority && (
                    <li className="flex items-start gap-3">
                      <Check className="h-4 w-4 text-foreground mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">Priority Support</span>
                    </li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                {plan.name === subscription?.plan ? (
                  <Button variant="secondary" className="w-full h-10" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full h-10"
                    onClick={() => handleUpgrade(plan.name)}
                    disabled={createCheckoutMutation.isPending}
                  >
                    {createCheckoutMutation.isPending ? 'Processing...' : 'Upgrade'}
                  </Button>
                )}
              </CardFooter>
            </Card>
            ))}
          </div>
        )}
        {!plansLoading && !plansError && (!Array.isArray(plans) || plans.length === 0) && (
          <div className="text-center py-12 text-muted-foreground">No plans available.</div>
        )}
      </div>

      {/* Payment History */}
      {payments && payments.length > 0 && (
        <Card className="border-border/40">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Payment History</CardTitle>
            <CardDescription className="text-sm">Your recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between py-4 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-4">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm text-foreground">
                        ${payment.amount / 100} {payment.currency.toUpperCase()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {safeFormatDate(payment.createdAt, 'PPp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={payment.status === 'succeeded' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                      {payment.status}
                    </Badge>
                    {payment.receiptUrl && (
                      <Button variant="outline" size="sm" className="h-8" asChild>
                        <a href={payment.receiptUrl} target="_blank" rel="noopener noreferrer">
                          Receipt
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
