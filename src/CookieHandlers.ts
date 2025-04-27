import type {Page} from 'playwright'

/**
 * Comprehensive function to detect and handle cookie consent banners
 * @param page Playwright Page object
 * @returns Promise that resolves when cookie handling is complete
 */
async function handleCookieBanners(page: Page): Promise<void> {
  console.log('Attempting to handle cookie consent banners...')

  // Common cookie banner selectors - ordered by specificity and frequency
  const bannerSelectors = [
    // Standard cookie notice containers
    '#cookie-banner',
    '.cookie-banner',
    '#cookieBanner',
    '.cookie-consent',
    '#cookie-consent',
    '#cookieConsent',
    '.cookie-notice',
    '#cookie-notice',
    '#cookieNotice',
    '.cookies-banner',
    '#cookies-banner',
    '#cookiesBanner',

    // GDPR specific containers
    '.gdpr-banner',
    '#gdpr-banner',
    '#gdprBanner',
    '.gdpr-consent',
    '#gdpr-consent',
    '#gdprConsent',
    '.gdpr-notice',
    '#gdpr-notice',

    // Common class name patterns
    '[class*="cookie-banner"]',
    '[class*="cookie_banner"]',
    '[class*="cookieBanner"]',
    '[class*="cookie-consent"]',
    '[class*="cookie_consent"]',
    '[class*="cookieConsent"]',
    '[class*="cookie-notice"]',
    '[class*="cookie_notice"]',
    '[class*="cookieNotice"]',
    '[class*="gdpr-banner"]',
    '[class*="gdpr_banner"]',
    '[class*="gdprBanner"]',

    // General privacy notices that may contain cookie consent
    '.privacy-notice',
    '#privacy-notice',
    '.privacy-banner',
    '#privacy-banner',
    '.consent-banner',
    '#consent-banner',
    '.consent-modal',
    '#consent-modal',

    // Dynamic IDs with patterns
    '[id*="cookie-banner"]',
    '[id*="cookie_banner"]',
    '[id*="cookieBanner"]',
    '[id*="cookie-consent"]',
    '[id*="cookie_consent"]',
    '[id*="cookieConsent"]',
  ]

  // Accept button selectors - ordered by likelihood
  const acceptSelectors = [
    // Direct text matching - most reliable across languages
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("I Accept")',
    'button:has-text("Allow All")',
    'button:has-text("Allow Cookies")',
    'button:has-text("Accept Cookies")',
    'button:has-text("I Agree")',
    'button:has-text("Agree")',
    'button:has-text("Agree to All")',
    'button:has-text("OK")',
    'button:has-text("Continue")',
    'button:has-text("Allow")',
    'a:has-text("Accept")',
    'a:has-text("Accept All")',
    'a:has-text("I Accept")',
    'a:has-text("Allow All")',

    // Common ID and class patterns for accept buttons
    'button[id*="accept"]',
    'button[class*="accept"]',
    'button[id*="agree"]',
    'button[class*="agree"]',
    'button[id*="allow"]',
    'button[class*="allow"]',
    'button[id*="consent"]',
    'button[class*="consent"]',
    'button[id*="cookie-accept"]',
    'button[class*="cookie-accept"]',
    '.accept-cookies',
    '#accept-cookies',
    '.accept-all',
    '#accept-all',
    '.acceptAll',
    '#acceptAll',
    '.accept',
    '#accept',
    '.agree',
    '#agree',

    // Less specific but common patterns
    '.btn-accept',
    '#btn-accept',
    '.btn-agree',
    '#btn-agree',
    '.accept-btn',
    '#accept-btn',
    '.agree-btn',
    '#agree-btn',
    '.consent-btn',
    '#consent-btn',
    '.btn-consent',
    '#btn-consent',

    // Some sites use form elements
    'input[type="submit"][value*="Accept"]',
    'input[type="button"][value*="Accept"]',
    'input[type="submit"][value*="Agree"]',
    'input[type="button"][value*="Agree"]',
  ]

  let bannerFound = false
  let buttonFound = false

  // Helper function to attempt clicking an element with multiple strategies
  async function attemptClick(
    element: any,
    description: string
  ): Promise<boolean> {
    const strategies = [
      // Strategy 1: Standard click
      async () => {
        console.log(`Attempting standard click on ${description}...`)
        await element.click()
        return true
      },
      // Strategy 2: Click with force option
      async () => {
        console.log(`Attempting force click on ${description}...`)
        await element.click({force: true})
        return true
      },
      // Strategy 3: Click with position center
      async () => {
        console.log(`Attempting centered click on ${description}...`)
        const box = await element.boundingBox()
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
          return true
        }
        return false
      },
      // Strategy 4: Evaluate a JS click
      async () => {
        console.log(`Attempting JavaScript click on ${description}...`)
        await element.evaluate((el: Element) => (el as HTMLElement).click())
        return true
      },
    ]

    for (const strategy of strategies) {
      try {
        const success = await strategy()
        if (success) {
          console.log(`Successfully clicked ${description}`)
          await page.waitForTimeout(500) // Wait for banner to disappear
          return true
        }
      } catch (e:any) {
        console.warn(`Click strategy failed on ${description}: ${e.message}`)
      }
    }

    console.warn(`All click strategies failed for ${description}`)
    return false
  }

  // Strategy 1: Try to find a banner first, then look for buttons within it
  for (const bannerSelector of bannerSelectors) {
    try {
      const banner = await page.$(bannerSelector)
      if (banner) {
        console.log(`Found cookie banner with selector: ${bannerSelector}`)
        bannerFound = true

        // Look for accept buttons within this banner
        for (const acceptSelector of acceptSelectors) {
          try {
            const acceptButton = await banner.$(acceptSelector)
            if (acceptButton) {
              console.log(
                `Found accept button with selector: ${acceptSelector} within banner`
              )
              if (
                await attemptClick(
                  acceptButton,
                  `${acceptSelector} within ${bannerSelector}`
                )
              ) {
                buttonFound = true
                break
              }
            }
          } catch (e:any) {
            // Continue to next accept selector
          }
        }

        if (buttonFound) break
      }
    } catch (e:any) {
      // Continue to next banner selector
    }
  }

  // Strategy 2: If no banner was found or no button was clicked within a banner,
  // try looking for accept buttons directly
  if (!buttonFound) {
    for (const acceptSelector of acceptSelectors) {
      try {
        // Check if element exists and is visible
        const isVisible = await page.evaluate((selector) => {
          const el = document.querySelector(selector)
          if (!el) return false

          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()

          return (
            style &&
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            window.getComputedStyle(el).pointerEvents !== 'none'
          )
        }, acceptSelector)

        if (isVisible) {
          console.log(
            `Found visible accept button with selector: ${acceptSelector}`
          )
          try {
            const element = await page.$(acceptSelector)
            if (element) {
              if (await attemptClick(element, acceptSelector)) {
                buttonFound = true
                break
              }
            }
          } catch (e:any) {
            console.warn(
              `Error handling button with selector ${acceptSelector}: ${e.message}`
            )
          }
        }
      } catch (e:any) {
        console.warn(
          `Error evaluating visibility for ${acceptSelector}: ${e.message}`
        )
      }
    }
  }

  // Strategy 3: Check for and handle cookie banners inside iframes
  if (!buttonFound) {
    console.log('Checking for cookie banners inside iframes...')
    const frames = page.frames()
    for (const frame of frames) {
      // Skip main frame
      if (frame === page.mainFrame()) continue

      try {
        // First check if this might be a cookie consent iframe by URL or name
        const frameName = await frame.name()
        const frameUrl = frame.url()

        if (
          frameName.toLowerCase().includes('cookie') ||
          frameName.toLowerCase().includes('consent') ||
          frameName.toLowerCase().includes('gdpr') ||
          frameUrl.toLowerCase().includes('cookie') ||
          frameUrl.toLowerCase().includes('consent') ||
          frameUrl.toLowerCase().includes('gdpr')
        ) {
          console.log(`Found potential cookie iframe: ${frameName || frameUrl}`)

          // Look for accept buttons in this frame
          for (const acceptSelector of acceptSelectors) {
            try {
              const buttonExists = await frame.$(acceptSelector)
              if (buttonExists) {
                console.log(
                  `Found accept button in iframe with selector: ${acceptSelector}`
                )
                try {
                  await frame.click(acceptSelector, {timeout: 2000})
                  console.log('Successfully clicked accept button in iframe')
                  buttonFound = true
                  await page.waitForTimeout(500)
                  break
                } catch (e:any) {
                  console.warn(`Failed to click button in iframe: ${e.message}`)
                  // Try force click as fallback
                  try {
                    await frame.click(acceptSelector, {
                      force: true,
                      timeout: 2000,
                    })
                    console.log(
                      'Successfully force-clicked accept button in iframe'
                    )
                    buttonFound = true
                    await page.waitForTimeout(500)
                    break
                  } catch (e2:any) {
                    console.warn(
                      `Failed to force-click button in iframe: ${e2.message}`
                    )
                  }
                }
              }
            } catch (e:any) {
              // Continue to next selector
            }
          }

          if (buttonFound) break
        }
      } catch (e:any) {
        console.warn(`Error checking iframe: ${e.message}`)
      }
    }
  }

  // Strategy 4: Try more generic approaches as a last resort
  if (!buttonFound) {
    console.log('Trying generic approach for cookie banners...')

    // Look for elements containing text like "accept" or "allow" that might be clickable
    try {
      const genericClickableTexts = [
        'text="Accept all cookies"',
        'text="Accept All Cookies"',
        'text="I accept"',
        'text="Accept"',
        'text="Allow all"',
        'text="Agree"',
        'text="Agree to all"',
        'text="OK"',
      ]

      for (const textSelector of genericClickableTexts) {
        try {
          const elements = await page.$$(textSelector)
          for (const element of elements) {
            try {
              console.log(`Attempting to click element with ${textSelector}`)
              if (await attemptClick(element, textSelector)) {
                buttonFound = true
                break
              }
            } catch (e:any) {
              // Try next element
            }
          }
          if (buttonFound) break
        } catch (e:any) {
          // Try next selector
        }
      }

      // Strategy 5: Last resort - look for any potentially cookie-related element by text content
      if (!buttonFound) {
        console.log(
          'Trying last resort approach - scanning visible elements for cookie-related text'
        )
        const cookieKeywords = ['cookie', 'consent', 'gdpr', 'accept', 'agree']

        // Try to find clickable elements containing cookie-related text
        const potentialElements = await page.evaluate((keywords) => {
          const results = []
          // Get all potentially clickable elements
          const elements = document.querySelectorAll(
            'button, a, input[type="button"], input[type="submit"], [role="button"], [tabindex="0"]'
          )

          for (const el of elements) {
            const text = el.textContent?.toLowerCase() || ''
            if (keywords.some((keyword) => text.includes(keyword))) {
              // Get element details
              const rect = el.getBoundingClientRect()
              if (rect.width > 0 && rect.height > 0) {
                const style = window.getComputedStyle(el)
                if (
                  style.display !== 'none' &&
                  style.visibility !== 'hidden' &&
                  style.opacity !== '0'
                ) {
                  // Get a unique selector for this element
                  let path = ''
                  let node = el as Element
                  while (node) {
                    if (node.id) {
                      path = `#${node.id} ${path}`.trim()
                      break
                    } else if (
                      node.className &&
                      typeof node.className === 'string'
                    ) {
                      const classes = node.className
                        .split(/\s+/)
                        .filter(Boolean)
                      if (classes.length) {
                        path = `.${classes.join('.')} ${path}`.trim()
                        break
                      }
                    }

                    // Count same-type siblings
                    let count = 0
                    let sibling = node.previousElementSibling
                    while (sibling) {
                      if (sibling.nodeName === node.nodeName) count++
                      sibling = sibling.previousElementSibling
                    }

                    const pathSegment =
                      node.nodeName.toLowerCase() +
                      (count ? `:nth-child(${count + 1})` : '')
                    path = path ? `${pathSegment} > ${path}` : pathSegment

                    node = node.parentElement as Element
                    if (!node || node === document.body) break
                  }

                  results.push({
                    text,
                    selector: path || '',
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                  })
                }
              }
            }
          }
          return results
        }, cookieKeywords)

        // Try to click the potential elements
        for (const el of potentialElements) {
          console.log(
            `Found potential cookie-related element: "${el.text}" at selector: ${el.selector}`
          )
          try {
            if (el.selector) {
              const element = await page.$(el.selector)
              if (element) {
                if (
                  await attemptClick(
                    element,
                    `"${el.text}" element with selector ${el.selector}`
                  )
                ) {
                  buttonFound = true
                  break
                }
              }
            }

            // Fallback to position click if selector failed
            if (!buttonFound && el.x && el.y) {
              console.log(
                `Attempting position click at ${el.x},${el.y} for "${el.text}"`
              )
              await page.mouse.click(el.x, el.y)
              console.log(`Successfully clicked at position ${el.x},${el.y}`)
              buttonFound = true
              await page.waitForTimeout(500)
              break
            }
          } catch (e:any) {
            console.warn(
              `Failed to click potential cookie element: ${e.message}`
            )
          }
        }
      }
    } catch (e:any) {
      console.warn(`Error in generic click attempt: ${e.message}`)
    }
  }

  // Report results
  if (bannerFound || buttonFound) {
    console.log(
      `Cookie banner handling results: Banner found: ${bannerFound}, Button clicked: ${buttonFound}`
    )
  } else {
    console.log(
      'No cookie banners detected or no accept buttons could be clicked'
    )
  }

  return
}

export default handleCookieBanners
