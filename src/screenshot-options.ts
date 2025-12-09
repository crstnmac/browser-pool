import type { Page } from 'playwright'
import { z } from 'zod'

/**
 * Device presets for emulation
 */
export const DEVICE_PRESETS = {
  desktop: {
    viewport: { width: 1920, height: 1080 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  laptop: {
    viewport: { width: 1366, height: 768 },
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  tablet: {
    viewport: { width: 768, height: 1024 },
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    viewport: { width: 375, height: 667 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
}

/**
 * Screenshot options schema
 */
export const screenshotOptionsSchema = z.object({
  // Basic options
  fullPage: z.boolean().default(true),
  format: z.enum(['png', 'jpeg']).default('png'),
  quality: z.number().min(0).max(100).optional(),

  // Viewport options
  viewport: z
    .object({
      width: z.number().min(320).max(3840),
      height: z.number().min(240).max(2160),
    })
    .optional(),

  // Device emulation
  device: z.enum(['desktop', 'laptop', 'tablet', 'mobile']).optional(),

  // Custom CSS
  css: z.string().optional(),

  // Wait options
  waitFor: z
    .object({
      timeout: z.number().min(0).max(30000).default(0),
      selector: z.string().optional(),
    })
    .optional(),

  // Screenshot clip region
  clip: z
    .object({
      x: z.number().min(0),
      y: z.number().min(0),
      width: z.number().min(1),
      height: z.number().min(1),
    })
    .optional(),

  // Dark mode
  darkMode: z.boolean().default(false),
})

export type ScreenshotOptions = z.infer<typeof screenshotOptionsSchema>

/**
 * Apply screenshot options to a page
 */
export async function applyScreenshotOptions(
  page: Page,
  options: ScreenshotOptions
): Promise<void> {
  // Apply device emulation if specified
  if (options.device) {
    const preset = DEVICE_PRESETS[options.device]
    await page.setViewportSize(preset.viewport)
  } else if (options.viewport) {
    // Apply custom viewport
    await page.setViewportSize(options.viewport)
  }

  // Apply dark mode if requested
  if (options.darkMode) {
    await page.emulateMedia({ colorScheme: 'dark' })
  }

  // Inject custom CSS if provided
  if (options.css) {
    await page.addStyleTag({ content: options.css })
  }

  // Wait for selector if specified
  if (options.waitFor?.selector) {
    await page.waitForSelector(options.waitFor.selector, {
      timeout: options.waitFor.timeout || 5000,
    })
  } else if (options.waitFor?.timeout) {
    // Just wait for the specified timeout
    await page.waitForTimeout(options.waitFor.timeout)
  }
}

/**
 * Take screenshot with options
 */
export async function takeScreenshotWithOptions(
  page: Page,
  options: ScreenshotOptions
): Promise<Buffer> {
  const screenshotConfig: any = {
    fullPage: options.fullPage,
    type: options.format,
  }

  // Add quality for JPEG
  if (options.format === 'jpeg' && options.quality !== undefined) {
    screenshotConfig.quality = options.quality
  }

  // Add clip region if specified
  if (options.clip) {
    screenshotConfig.clip = options.clip
  }

  return await page.screenshot(screenshotConfig)
}
