import { OpenAPIHono } from '@hono/zod-openapi'
import { swaggerUI } from '@hono/swagger-ui'

/**
 * OpenAPI/Swagger Documentation
 */

export function createOpenAPIApp() {
  const app = new OpenAPIHono()

  // OpenAPI specification
  app.doc('/openapi.json', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Browser Pool SaaS API',
      description: 'Screenshot-as-a-Service with cookie consent handling, subscription management, and advanced features',
      contact: {
        name: 'API Support',
        email: 'support@browserpool.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'API Server',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'API key for authentication',
        },
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            plan: { type: 'string', enum: ['FREE', 'PRO', 'ENTERPRISE'] },
            status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DELETED'] },
            emailVerified: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        ApiKey: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            key: { type: 'string', description: 'Only returned on creation' },
            createdAt: { type: 'string', format: 'date-time' },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        ScreenshotOptions: {
          type: 'object',
          properties: {
            fullPage: { type: 'boolean', default: true },
            format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' },
            quality: { type: 'number', minimum: 0, maximum: 100 },
            viewport: {
              type: 'object',
              properties: {
                width: { type: 'number', minimum: 320, maximum: 3840 },
                height: { type: 'number', minimum: 240, maximum: 2160 },
              },
            },
            device: { type: 'string', enum: ['desktop', 'laptop', 'tablet', 'mobile'] },
            css: { type: 'string', description: 'Custom CSS to inject' },
            waitFor: {
              type: 'object',
              properties: {
                timeout: { type: 'number', minimum: 0, maximum: 30000 },
                selector: { type: 'string' },
              },
            },
            clip: {
              type: 'object',
              properties: {
                x: { type: 'number', minimum: 0 },
                y: { type: 'number', minimum: 0 },
                width: { type: 'number', minimum: 1 },
                height: { type: 'number', minimum: 1 },
              },
            },
            darkMode: { type: 'boolean', default: false },
          },
        },
        Screenshot: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'uri' },
            format: { type: 'string', enum: ['png', 'jpeg'] },
            fileSize: { type: 'number' },
            metadata: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        ScheduledScreenshot: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            cronExpression: { type: 'string', description: 'Cron expression' },
            isActive: { type: 'boolean' },
            saveHistory: { type: 'boolean' },
            webhookOnComplete: { type: 'boolean' },
            lastRunAt: { type: 'string', format: 'date-time', nullable: true },
            nextRunAt: { type: 'string', format: 'date-time', nullable: true },
            runCount: { type: 'number' },
            failureCount: { type: 'number' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' },
            secret: { type: 'string', description: 'For signature verification' },
            lastTriggeredAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            plan: { type: 'string', enum: ['PRO', 'ENTERPRISE'] },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'TRIALING'],
            },
            currentPeriodStart: { type: 'string', format: 'date-time' },
            currentPeriodEnd: { type: 'string', format: 'date-time' },
            cancelAtPeriodEnd: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication and registration' },
      { name: 'Screenshots', description: 'Screenshot capture endpoints' },
      { name: 'Screenshots History', description: 'Screenshot history management' },
      { name: 'Scheduled Screenshots', description: 'Cron-based scheduled screenshots' },
      { name: 'Webhooks', description: 'User-defined webhook management' },
      { name: 'Subscriptions', description: 'Subscription and billing management' },
      { name: 'Account', description: 'User account management' },
      { name: 'Admin', description: 'Administrative endpoints' },
    ],
    paths: {
      '/auth/register': {
        post: {
          tags: ['Authentication'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'name'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'User created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      token: { type: 'string' },
                      apiKey: { $ref: '#/components/schemas/ApiKey' },
                    },
                  },
                },
              },
            },
            '400': { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Login successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { $ref: '#/components/schemas/User' },
                      token: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Invalid credentials' },
          },
        },
      },
      '/screenshot': {
        post: {
          tags: ['Screenshots'],
          summary: 'Capture a screenshot',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url'],
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    cookieConsent: { type: 'boolean', default: true },
                    saveHistory: { type: 'boolean', default: false },
                    options: { $ref: '#/components/schemas/ScreenshotOptions' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Screenshot captured successfully',
              content: {
                'image/png': { schema: { type: 'string', format: 'binary' } },
                'image/jpeg': { schema: { type: 'string', format: 'binary' } },
              },
              headers: {
                'X-Screenshot-Id': {
                  description: 'Screenshot ID if saved to history',
                  schema: { type: 'string' },
                },
              },
            },
            '400': { description: 'Invalid request' },
            '401': { description: 'Authentication required' },
            '429': { description: 'Rate limit or quota exceeded' },
          },
        },
      },
      '/screenshot/bulk': {
        post: {
          tags: ['Screenshots'],
          summary: 'Capture multiple screenshots in bulk',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['urls'],
                  properties: {
                    urls: {
                      type: 'array',
                      items: { type: 'string', format: 'uri' },
                      maxItems: 10,
                    },
                    cookieConsent: { type: 'boolean', default: true },
                    options: { $ref: '#/components/schemas/ScreenshotOptions' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Bulk screenshot results',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      total: { type: 'number' },
                      successful: { type: 'number' },
                      failed: { type: 'number' },
                      screenshots: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            url: { type: 'string' },
                            success: { type: 'boolean' },
                            screenshot: { type: 'string', description: 'Base64 encoded' },
                            error: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/screenshots': {
        get: {
          tags: ['Screenshots History'],
          summary: 'List screenshot history',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'number', default: 20 } },
            { name: 'offset', in: 'query', schema: { type: 'number', default: 0 } },
            { name: 'url', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Screenshot history',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      screenshots: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Screenshot' },
                      },
                      total: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Screenshots History'],
          summary: 'Delete all screenshots',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'url', in: 'query', schema: { type: 'string' }, description: 'Filter by URL' },
          ],
          responses: {
            '200': { description: 'Screenshots deleted' },
          },
        },
      },
      '/screenshots/{id}': {
        get: {
          tags: ['Screenshots History'],
          summary: 'Get screenshot image',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Screenshot image',
              content: {
                'image/png': { schema: { type: 'string', format: 'binary' } },
                'image/jpeg': { schema: { type: 'string', format: 'binary' } },
              },
            },
            '404': { description: 'Screenshot not found' },
          },
        },
        delete: {
          tags: ['Screenshots History'],
          summary: 'Delete a screenshot',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': { description: 'Screenshot deleted' },
            '404': { description: 'Screenshot not found' },
          },
        },
      },
      '/scheduled': {
        get: {
          tags: ['Scheduled Screenshots'],
          summary: 'List scheduled screenshots',
          security: [{ ApiKeyAuth: [] }],
          parameters: [
            { name: 'active', in: 'query', schema: { type: 'boolean' } },
          ],
          responses: {
            '200': {
              description: 'Scheduled screenshots',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      schedules: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/ScheduledScreenshot' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Scheduled Screenshots'],
          summary: 'Create scheduled screenshot',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name', 'url', 'cronExpression'],
                  properties: {
                    name: { type: 'string' },
                    url: { type: 'string', format: 'uri' },
                    cronExpression: { type: 'string' },
                    options: { $ref: '#/components/schemas/ScreenshotOptions' },
                    saveHistory: { type: 'boolean', default: true },
                    webhookOnComplete: { type: 'boolean', default: false },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Schedule created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ScheduledScreenshot' },
                },
              },
            },
            '403': { description: 'Schedule limit reached' },
          },
        },
      },
      '/webhooks': {
        get: {
          tags: ['Webhooks'],
          summary: 'List webhooks',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Webhooks list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      webhooks: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Webhook' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags: ['Webhooks'],
          summary: 'Create webhook',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: { type: 'string', format: 'uri' },
                    events: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: [
                          'screenshot.completed',
                          'screenshot.failed',
                          'quota.warning',
                          'quota.exceeded',
                        ],
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Webhook created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Webhook' },
                },
              },
            },
          },
        },
      },
      '/subscriptions': {
        get: {
          tags: ['Subscriptions'],
          summary: 'Get user subscriptions',
          security: [{ ApiKeyAuth: [] }],
          responses: {
            '200': {
              description: 'Subscriptions list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      subscriptions: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Subscription' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/subscriptions/checkout': {
        post: {
          tags: ['Subscriptions'],
          summary: 'Create checkout session',
          security: [{ ApiKeyAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['plan'],
                  properties: {
                    plan: { type: 'string', enum: ['PRO', 'ENTERPRISE'] },
                    successUrl: { type: 'string', format: 'uri' },
                    cancelUrl: { type: 'string', format: 'uri' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Checkout session created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      checkoutUrl: { type: 'string', format: 'uri' },
                      sessionId: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  // Swagger UI
  app.get('/docs', swaggerUI({ url: '/openapi.json' }))

  return app
}
