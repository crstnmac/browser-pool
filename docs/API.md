# Browser Pool SaaS API Documentation

## Overview

Browser Pool is a Screenshot-as-a-Service platform that provides automated screenshot capture with intelligent cookie consent handling.

**Base URL**: `https://api.yourapp.com` (or `http://localhost:3000` for development)

## Authentication

All API endpoints (except `/auth/*` and `/health`) require authentication using an API key.

### API Key Authentication

Include your API key in the request header:

```
X-API-Key: bp_live_your_api_key_here
```

Or use Bearer token:

```
Authorization: Bearer bp_live_your_api_key_here
```

## Rate Limits

Rate limits are enforced based on your subscription plan:

- **Free**: 5 requests/minute
- **Pro**: 30 requests/minute
- **Enterprise**: 100 requests/minute

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 2024-01-15T12:00:00Z
```

## Quotas

Monthly request quotas based on subscription:

- **Free**: 100 screenshots/month
- **Pro**: 5,000 screenshots/month
- **Enterprise**: 100,000 screenshots/month

## Endpoints

### Authentication

#### POST /auth/register

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "FREE"
  },
  "apiKey": {
    "id": "uuid",
    "key": "bp_test_xxxxxxxxxx",
    "name": "Default Key",
    "message": "Store this API key securely. You will not be able to see it again."
  }
}
```

#### POST /auth/login

Login and retrieve API keys.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "PRO",
    "isAdmin": false
  },
  "apiKeys": [
    {
      "id": "uuid",
      "name": "Default Key",
      "createdAt": "2024-01-15T12:00:00Z",
      "lastUsedAt": "2024-01-15T13:00:00Z"
    }
  ]
}
```

### Screenshots

#### POST /screenshot

Take a screenshot of a webpage.

**Authentication Required**: Yes

**Request Body:**
```json
{
  "url": "https://example.com",
  "cookieConsent": true
}
```

**Parameters:**
- `url` (required): The URL to capture
- `cookieConsent` (optional): Handle cookie banners (default: true)

**Response:** `200 OK`
- Content-Type: `image/png`
- Body: PNG image binary data

**Error Responses:**
- `400`: Invalid URL or missing parameters
- `401`: Invalid or missing API key
- `429`: Rate limit or quota exceeded
- `500`: Screenshot capture failed

### User Management

#### GET /users/me

Get current user profile.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "PRO",
    "status": "ACTIVE",
    "isAdmin": false,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T12:00:00Z"
  }
}
```

#### GET /users/usage

Get current usage statistics.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "quota": {
    "used": 150,
    "limit": 5000,
    "remaining": 4850,
    "periodStart": "2024-01-01T00:00:00Z",
    "periodEnd": "2024-01-31T23:59:59Z"
  },
  "recentRequests": [
    {
      "id": "uuid",
      "endpoint": "/screenshot",
      "urlRequested": "https://example.com",
      "statusCode": 200,
      "responseTimeMs": 1234,
      "createdAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### API Key Management

#### GET /users/api-keys

List all API keys.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "apiKeys": [
    {
      "id": "uuid",
      "name": "Production Key",
      "createdAt": "2024-01-01T00:00:00Z",
      "lastUsedAt": "2024-01-15T12:00:00Z",
      "revokedAt": null
    }
  ]
}
```

#### POST /users/api-keys

Create a new API key.

**Authentication Required**: Yes

**Request Body:**
```json
{
  "name": "Production Key"
}
```

**Response:** `201 Created`
```json
{
  "message": "API key created successfully",
  "apiKey": {
    "id": "uuid",
    "key": "bp_live_xxxxxxxxxx",
    "name": "Production Key",
    "createdAt": "2024-01-15T12:00:00Z",
    "warning": "Store this API key securely. You will not be able to see it again."
  }
}
```

#### DELETE /users/api-keys/:id

Revoke an API key.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "message": "API key revoked successfully"
}
```

### Subscriptions

#### GET /subscriptions/plans

Get available subscription plans (public endpoint).

**Authentication Required**: No

**Response:** `200 OK`
```json
{
  "plans": [
    {
      "id": "FREE",
      "name": "Free",
      "price": 0,
      "currency": "USD",
      "interval": "month",
      "features": ["100 screenshots/month", "5 requests/minute"],
      "quota": 100,
      "rateLimit": 5
    },
    {
      "id": "PRO",
      "name": "Pro",
      "price": 29,
      "currency": "USD",
      "interval": "month",
      "features": ["5,000 screenshots/month", "30 requests/minute"],
      "quota": 5000,
      "rateLimit": 30
    }
  ]
}
```

#### GET /subscriptions

Get user's active subscription.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "subscription": {
    "id": "uuid",
    "plan": "PRO",
    "status": "ACTIVE",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false
  }
}
```

#### POST /subscriptions/checkout

Create a checkout session for a new subscription.

**Authentication Required**: Yes

**Request Body:**
```json
{
  "plan": "PRO",
  "trialDays": 7,
  "successUrl": "https://yourapp.com/success",
  "cancelUrl": "https://yourapp.com/cancel"
}
```

**Response:** `201 Created`
```json
{
  "message": "Checkout session created",
  "checkoutUrl": "https://checkout.dodo.com/session/abc123",
  "sessionId": "cs_abc123"
}
```

#### POST /subscriptions/upgrade

Upgrade or downgrade subscription.

**Authentication Required**: Yes

**Request Body:**
```json
{
  "plan": "ENTERPRISE"
}
```

**Response:** `200 OK`
```json
{
  "message": "Subscription upgraded successfully",
  "subscription": {
    "id": "uuid",
    "plan": "ENTERPRISE",
    "status": "ACTIVE"
  }
}
```

#### POST /subscriptions/cancel

Cancel subscription at end of billing period.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "message": "Subscription will be canceled at the end of the billing period",
  "subscription": {...},
  "activeUntil": "2024-02-01T00:00:00Z"
}
```

#### POST /subscriptions/reactivate

Reactivate a canceled subscription.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "message": "Subscription reactivated successfully",
  "subscription": {...}
}
```

#### GET /subscriptions/payments

Get payment history.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 2900,
      "currency": "USD",
      "status": "SUCCEEDED",
      "plan": "PRO",
      "paidAt": "2024-01-01T00:00:00Z",
      "receiptUrl": "https://dodo.com/receipts/abc123"
    }
  ]
}
```

### Webhooks

#### GET /webhooks

List all webhooks.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "webhooks": [
    {
      "id": "uuid",
      "url": "https://yourapp.com/webhook",
      "events": ["screenshot.completed", "quota.warning"],
      "isActive": true,
      "lastTriggeredAt": "2024-01-15T12:00:00Z",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

#### POST /webhooks

Create a new webhook.

**Authentication Required**: Yes

**Request Body:**
```json
{
  "url": "https://yourapp.com/webhook",
  "events": ["screenshot.completed", "screenshot.failed", "quota.warning"]
}
```

**Available Events:**
- `screenshot.completed` - Screenshot captured successfully
- `screenshot.failed` - Screenshot capture failed
- `quota.warning` - 80% of monthly quota used
- `quota.exceeded` - Monthly quota exceeded
- `apikey.created` - New API key created
- `apikey.revoked` - API key revoked

**Response:** `201 Created`
```json
{
  "message": "Webhook created successfully",
  "webhook": {
    "id": "uuid",
    "url": "https://yourapp.com/webhook",
    "events": ["screenshot.completed"],
    "secret": "wh_secret_xxxxxxxxxx",
    "isActive": true,
    "createdAt": "2024-01-15T12:00:00Z",
    "warning": "Store the secret securely. Use it to verify webhook signatures."
  }
}
```

#### DELETE /webhooks/:id

Delete a webhook.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "message": "Webhook deleted successfully"
}
```

#### POST /webhooks/:id/test

Send a test webhook.

**Authentication Required**: Yes

**Response:** `200 OK`
```json
{
  "message": "Test webhook sent successfully",
  "note": "Check your webhook endpoint to verify it was received"
}
```

### Webhook Payload

When an event occurs, we'll send a POST request to your webhook URL:

```json
{
  "event": "screenshot.completed",
  "timestamp": "2024-01-15T12:00:00Z",
  "userId": "uuid",
  "data": {
    "url": "https://example.com",
    "timestamp": "2024-01-15T12:00:00Z"
  }
}
```

**Headers:**
```
Content-Type: application/json
X-Webhook-Signature: sha256_signature
X-Webhook-Event: screenshot.completed
```

**Verifying Webhooks:**

```javascript
const crypto = require('crypto')

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

### Admin Endpoints

Admin endpoints require an API key from an admin user.

#### GET /admin/users

List all users (paginated).

**Authentication Required**: Yes (Admin)

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Results per page (default: 20)

**Response:** `200 OK`
```json
{
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### GET /admin/analytics

Get system-wide analytics.

**Authentication Required**: Yes (Admin)

**Response:** `200 OK`
```json
{
  "users": {
    "total": 1500,
    "active": 450,
    "byPlan": [
      {"plan": "FREE", "_count": 1200},
      {"plan": "PRO", "_count": 250},
      {"plan": "ENTERPRISE", "_count": 50}
    ]
  },
  "requests": {
    "total": 500000,
    "last30Days": 45000,
    "errorRate": "2.5%"
  },
  "performance": {
    "avgResponseTime": "1234.56ms"
  }
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "details": [] // Optional validation errors
}
```

**Common Status Codes:**
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Missing or invalid API key
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `429 Too Many Requests` - Rate limit or quota exceeded
- `500 Internal Server Error` - Server error

## Code Examples

### cURL

```bash
# Take a screenshot
curl -X POST https://api.yourapp.com/screenshot \
  -H "X-API-Key: bp_live_your_key" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}' \
  -o screenshot.png
```

### JavaScript/Node.js

```javascript
const axios = require('axios')
const fs = require('fs')

async function takeScreenshot(url) {
  const response = await axios.post(
    'https://api.yourapp.com/screenshot',
    { url },
    {
      headers: {
        'X-API-Key': 'bp_live_your_key',
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer'
    }
  )

  fs.writeFileSync('screenshot.png', response.data)
}
```

### Python

```python
import requests

def take_screenshot(url):
    response = requests.post(
        'https://api.yourapp.com/screenshot',
        json={'url': url},
        headers={'X-API-Key': 'bp_live_your_key'}
    )

    with open('screenshot.png', 'wb') as f:
        f.write(response.content)
```

## Support

For support or questions:
- Email: support@yourapp.com
- Documentation: https://docs.yourapp.com
- Status: https://status.yourapp.com
