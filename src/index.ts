import {serve} from '@hono/node-server'
import {Hono} from 'hono'
import {logger} from 'hono/logger'
import {cors} from 'hono/cors'
import {BrowserPool} from './BrowserPool.js'
import {handleCookieBanners} from './CookieHandlers.js' // Changed to named import
import handlePopups from './Popuphandlers.js'

const app = new Hono()
const browserPool = new BrowserPool(5)

app.use('*', logger())
app.use(
  '*',
  cors({
    origin: String(process.env.ORIGIN_URL),
    maxAge: 600,
  })
)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/api', (c) => {
  return c.json({message: 'Hello Hono!'})
})

app.post('/screenshot', async (c) => {
  const {url, cookieConsent = true} = await c.req.json()

  if (!url) {
    return c.json({error: 'URL is required'}, 400)
  }

  let page
  try {
    page = await browserPool.requirePage()

    // Clear cookies if needed
    await page.context().clearCookies()

    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000})

    if (cookieConsent) {
      try {
        await handlePopups(page)

        await handleCookieBanners(page)
      } catch (e) {
        console.warn('Error handling cookie consent:', e)
      }
    }

    // Take screenshot after all tasks
    const screenshot = await page.screenshot({fullPage: true})
    return c.body(screenshot, 200, {
      'Content-Type': 'image/png',
    })
  } catch (error) {
    console.error('Screenshot error:', error)
    return c.json({error: 'Failed to capture screenshot'}, 500)
  } finally {
    if (page) {
      await browserPool.releasePage(page)
    }
  }
})

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  }
)

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  await browserPool.close()
  process.exit(0)
})
