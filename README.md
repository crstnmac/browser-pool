# Browser Pool

A headless browser pool service for taking screenshots with cookie consent handling.

## Project Setup

1. Install dependencies:
```bash
npm install
npx playwright install
```

2. Start the development server:
```bash
npm run dev
```

## API Documentation

### Base URL
`http://localhost:3000`

### Endpoints

#### GET /
Basic health check endpoint.

#### POST /screenshot
Take a screenshot of a webpage.

**Request Body:**
```json
{
  "url": "https://example.com",
  "cookieConsent": true
}
```

**Parameters:**
- `url` (required): The URL of the webpage to screenshot
- `cookieConsent` (optional): Whether to handle cookie consent banners (default: true)

**Response:**
- Success: PNG image
- Error: JSON with error message

**Example Request:**
```bash
curl -X POST -H "Content-Type: application/json" -d '{"url": "https://example.com"}' http://localhost:3000/screenshot -o screenshot.png
```

## Configuration

Set environment variables in `.env` file:
```
ORIGIN_URL=http://localhost:3000