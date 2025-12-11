import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Building2, ArrowLeft } from 'lucide-react'
import { useCreateOrganization } from '@/hooks/use-organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'

const createOrganizationSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100, 'Name must be less than 100 characters'),
  slug: z.string()
    .min(1, 'Organization slug is required')
    .max(50, 'Slug must be less than 50 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens')
    .refine(slug => !slug.startsWith('-') && !slug.endsWith('-'), 'Slug cannot start or end with a hyphen'),
})

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>

export function CreateOrganizationPage() {
  const navigate = useNavigate()
  const createOrganizationMutation = useCreateOrganization()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
  })

  const nameValue = watch('name')

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()
      .slice(0, 50) // Limit length
  }

  const onSubmit = async (data: CreateOrganizationFormData) => {
    try {
      await createOrganizationMutation.mutateAsync(data)
      toast.success('Organization created successfully!')
      navigate('/organizations')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create organization')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/40">
        <CardHeader className="space-y-2 pb-6">
          <div className="flex items-center justify-center mb-2">
            <Building2 className="h-10 w-10 text-foreground" />
          </div>
          <CardTitle className="instrument-serif-regular text-2xl font-normal text-center tracking-tight">
            Create Organization
          </CardTitle>
          <CardDescription className="text-center text-sm">
            Set up a new organization to collaborate with your team
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter organization name"
                {...register('name')}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Organization Slug</Label>
              <Input
                id="slug"
                type="text"
                placeholder="organization-slug"
                {...register('slug')}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' && nameValue) {
                    // Auto-generate slug when field is cleared and name exists
                    e.target.value = generateSlug(nameValue)
                  }
                  register('slug').onChange(e)
                }}
                className={errors.slug ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                This will be used in URLs and cannot be changed later
              </p>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={createOrganizationMutation.isPending}
            >
              {createOrganizationMutation.isPending ? 'Creating...' : 'Create Organization'}
            </Button>

            <Link to="/dashboard" className="w-full">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
