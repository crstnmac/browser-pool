import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import {
  signIn,
  signUp,
  signOut,
  useSession,
} from '@/lib/auth'
import {
  userApi,
  screenshotsApi,
  webhooksApi,
  scheduledScreenshotsApi,
  adminApi,
} from '@/services/api'
import type { UpdateWebhookRequest } from '@/types/api'

// Auth hooks
export const useLogin = () => {
  const navigate = useNavigate()
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      signIn.email({ email, password }),
    onSuccess: () => {
      toast.success('Logged in successfully')
      navigate('/dashboard')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Login failed')
    },
  })
}

export const useRegister = () => {
  return useMutation({
    mutationFn: ({ email, password, name }: { email: string; password: string; name: string }) =>
      signUp.email({ email, password, name }),
    onSuccess: () => {
      toast.success('Registration successful! Please check your email to verify your account.')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Registration failed')
    },
  })
}

export const useLogout = () => {
  const navigate = useNavigate()
  return async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      toast.error('Failed to logout')
    }
  }
}

// User hooks
export const useUser = () => {
  const { data: session, isPending } = useSession()

  return {
    data: session?.user,
    isLoading: isPending,
    error: !session?.user ? new Error('No user session') : null,
  }
}

export const useUsage = () => {
  return useQuery({
    queryKey: ['usage'],
    queryFn: userApi.getUsage,
  })
}


// Screenshots hooks
export const useScreenshots = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['screenshots', page, limit],
    queryFn: () => screenshotsApi.list(page, limit),
  })
}

export const useScreenshot = (id: string) => {
  return useQuery({
    queryKey: ['screenshot', id],
    queryFn: () => screenshotsApi.get(id),
    enabled: !!id,
  })
}

export const useCreateScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Screenshot created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create screenshot')
    },
  })
}

export const useCreateBulkScreenshots = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.createBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      queryClient.invalidateQueries({ queryKey: ['usage'] })
      toast.success('Screenshots created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create screenshots')
    },
  })
}

export const useDeleteScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: screenshotsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['screenshots'] })
      toast.success('Screenshot deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete screenshot')
    },
  })
}

// Webhooks hooks
export const useWebhooks = () => {
  return useQuery({
    queryKey: ['webhooks'],
    queryFn: webhooksApi.list,
  })
}

export const useWebhook = (id: string) => {
  return useQuery({
    queryKey: ['webhook', id],
    queryFn: () => webhooksApi.get(id),
    enabled: !!id,
  })
}

export const useCreateWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: webhooksApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create webhook')
    },
  })
}

export const useUpdateWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookRequest }) =>
      webhooksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to update webhook')
    },
  })
}

export const useDeleteWebhook = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: webhooksApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete webhook')
    },
  })
}

export const useTestWebhook = () => {
  return useMutation({
    mutationFn: webhooksApi.test,
    onSuccess: () => {
      toast.success('Webhook test triggered successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to test webhook')
    },
  })
}

// Scheduled Screenshots hooks
export const useScheduledScreenshots = () => {
  return useQuery({
    queryKey: ['scheduledScreenshots'],
    queryFn: scheduledScreenshotsApi.list,
  })
}

export const useCreateScheduledScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduledScreenshotsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScreenshots'] })
      toast.success('Scheduled screenshot created successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to create scheduled screenshot')
    },
  })
}

export const useDeleteScheduledScreenshot = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: scheduledScreenshotsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledScreenshots'] })
      toast.success('Scheduled screenshot deleted successfully')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Failed to delete scheduled screenshot')
    },
  })
}

// Admin hooks
export const useAdminUsers = (page = 1, limit = 20) => {
  return useQuery({
    queryKey: ['adminUsers', page, limit],
    queryFn: () => adminApi.listUsers(page, limit),
  })
}

export const useAdminAnalytics = () => {
  return useQuery({
    queryKey: ['adminAnalytics'],
    queryFn: adminApi.getAnalytics,
  })
}

export const useAdminHealth = () => {
  return useQuery({
    queryKey: ['adminHealth'],
    queryFn: adminApi.getHealth,
    refetchInterval: 30000, // Refetch every 30 seconds
  })
}
