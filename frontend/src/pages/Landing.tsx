import { Link } from 'react-router-dom'
import { Camera, Zap, Shield, Clock, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function LandingPage() {
  const features = [
    {
      icon: Camera,
      title: 'High-Quality Screenshots',
      description: 'Capture pixel-perfect screenshots of any website in multiple formats and resolutions',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Our optimized browser pool ensures quick screenshot generation with minimal latency',
    },
    {
      icon: Shield,
      title: 'Smart Cookie Handling',
      description: 'Automatically detects and handles cookie consent banners and popups',
    },
    {
      icon: Clock,
      title: 'Scheduled Screenshots',
      description: 'Set up automated screenshot capture on a schedule with cron expressions',
    },
  ]

  const plans = [
    {
      name: 'Free',
      price: 0,
      screenshots: '100',
      rateLimit: '5 req/min',
      features: ['Basic screenshots', 'Cookie handling', 'API access'],
    },
    {
      name: 'Pro',
      price: 29,
      screenshots: '5,000',
      rateLimit: '30 req/min',
      features: ['All Free features', 'Webhooks', 'Scheduled screenshots', 'Priority support'],
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 199,
      screenshots: '100,000',
      rateLimit: '100 req/min',
      features: ['All Pro features', 'Admin dashboard', 'Custom integrations', '24/7 support'],
    },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center space-x-2">
            <Camera className="h-6 w-6" />
            <span className="font-bold text-xl">Browser Pool</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/register">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container px-4 py-24 md:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
            Screenshot as a Service
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Capture high-quality screenshots of any website with our powerful API.
            Smart cookie handling, scheduled captures, and lightning-fast performance.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Button size="lg" asChild>
              <Link to="/register">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">Learn More</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="container px-4 py-24 bg-muted/50">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon
              return (
                <Card key={feature.title}>
                  <CardHeader>
                    <Icon className="h-10 w-10 mb-2 text-primary" />
                    <CardTitle>{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="container px-4 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.name} className={plan.popular ? 'border-primary shadow-lg' : ''}>
                <CardHeader>
                  {plan.popular && (
                    <div className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded-full w-fit mb-2">
                      Most Popular
                    </div>
                  )}
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-4xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-muted-foreground">/month</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="font-semibold">{plan.screenshots} screenshots/month</div>
                    <div className="text-sm text-muted-foreground">{plan.rateLimit}</div>
                  </div>
                  <ul className="space-y-2">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button className="w-full" variant={plan.popular ? 'default' : 'outline'} asChild>
                    <Link to="/register">Get Started</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container px-4">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex items-center gap-2">
              <Camera className="h-6 w-6" />
              <span className="font-bold">Browser Pool</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 Browser Pool. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
