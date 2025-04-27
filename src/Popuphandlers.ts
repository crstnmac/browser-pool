import type {Page} from 'playwright'

/**
 * Comprehensive function to detect and handle mail subscription popups and other modal dialogs
 * @param page Playwright Page object
 * @returns Promise that resolves when popup handling is complete
 */
async function handlePopups(page: Page): Promise<void> {
  console.log('Attempting to handle mail subscription popups and dialogs...')

  // Common popup container selectors - ordered by specificity and frequency
  const popupSelectors = [
    // Accessibility-specific: ARIA role based selectors (high priority)
    '[role="dialog"][aria-modal="true"]',
    '[role="dialog"][aria-labelledby*="popup"]',
    '[role="dialog"][aria-labelledby*="newsletter"]',
    '[role="dialog"][aria-labelledby*="subscribe"]',

    // Newsletter and subscription popups
    '#newsletter-popup',
    '.newsletter-popup',
    '#newsletterPopup',
    '.newsletter-modal',
    '#newsletter-modal',
    '.newsletter-overlay',
    '#newsletter_popup',
    '.newsletter_modal',
    '#subscribe-popup',
    '.subscribe-popup',
    '#subscribePopup',
    '.subscribe-modal',
    '#subscribe-modal',
    '.subscribe-overlay',
    '#subscribe_popup',
    '.subscribe_modal',
    '#signup-popup',
    '.signup-popup',
    '#signupPopup',
    '.signup-modal',
    '#signup-modal',
    '.signup-overlay',
    '#signup_popup',
    '.signup_modal',
    '#email-popup',
    '.email-popup',
    '#emailPopup',
    '.email-modal',
    '#email-modal',
    '.email-overlay',
    '#email_popup',
    '.email_modal',

    // General modal/popup selectors
    '.modal',
    '#modal',
    '.popup',
    '#popup',
    '.overlay',
    '#overlay',
    '.modal-container',
    '#modal-container',
    '.popup-container',
    '#popup-container',
    '.modal-dialog',
    '#modal-dialog',
    '.popup-dialog',
    '#popup-dialog',
    '.modal-content',
    '#modal-content',
    '.popup-content',
    '#popup-content',
    '.lightbox',
    '#lightbox',
    '.modal-wrapper',
    '#modal-wrapper',

    // Common class name patterns
    '[class*="newsletter-popup"]',
    '[class*="newsletter_popup"]',
    '[class*="newsletterPopup"]',
    '[class*="subscribe-popup"]',
    '[class*="subscribe_popup"]',
    '[class*="subscribePopup"]',
    '[class*="signup-popup"]',
    '[class*="signup_popup"]',
    '[class*="signupPopup"]',
    '[class*="email-popup"]',
    '[class*="email_popup"]',
    '[class*="emailPopup"]',
    '[class*="modal-popup"]',
    '[class*="modal_popup"]',
    '[class*="modalPopup"]',

    // Dynamic IDs with patterns
    '[id*="newsletter-popup"]',
    '[id*="newsletter_popup"]',
    '[id*="newsletterPopup"]',
    '[id*="subscribe-popup"]',
    '[id*="subscribe_popup"]',
    '[id*="subscribePopup"]',
    '[id*="signup-popup"]',
    '[id*="signup_popup"]',
    '[id*="signupPopup"]',
    '[id*="email-popup"]',
    '[id*="email_popup"]',
    '[id*="emailPopup"]',
    '[id*="modal-popup"]',
    '[id*="modal_popup"]',
    '[id*="modalPopup"]',

    // Other common patterns for popups
    '.webform-popup',
    '#webform-popup',
    '.form-popup',
    '#form-popup',
    '.discount-popup',
    '#discount-popup',
    '.offer-popup',
    '#offer-popup',
    '.promo-popup',
    '#promo-popup',
    '.welcome-popup',
    '#welcome-popup',
    '.exit-popup',
    '#exit-popup',
    '.exit-intent',
    '#exit-intent',
  ]

  // Close/dismiss button selectors - ordered by likelihood
  const closeSelectors = [
    // Direct text matching - most reliable across languages
    'button:has-text("Close")',
    'button:has-text("Close Window")',
    'button:has-text("No Thanks")',
    'button:has-text("No, thanks")',
    'button:has-text("No, Thank You")',
    'button:has-text("Not Now")',
    'button:has-text("Later")',
    'button:has-text("Skip")',
    'button:has-text("Dismiss")',
    'button:has-text("Cancel")',
    'button:has-text("×")',
    'button:has-text("X")',
    'a:has-text("Close")',
    'a:has-text("No Thanks")',
    'a:has-text("Skip")',
    'a:has-text("×")',
    'a:has-text("X")',

    // Icon and symbol close buttons
    'button.close',
    '.close',
    '#close',
    'button.modal-close',
    '.modal-close',
    '#modal-close',
    'button.popup-close',
    '.popup-close',
    '#popup-close',
    '.modal__close',
    '#modal__close',
    '.popup__close',
    '#popup__close',
    '.newsletter-close',
    '#newsletter-close',
    '.subscribe-close',
    '#subscribe-close',
    '[aria-label="Close"]',
    '[aria-label="Dismiss"]',
    '[aria-label="Close dialog"]',
    '[aria-label="Close modal"]',
    '[aria-label="Close popup"]',
    '.close-icon',
    '#close-icon',
    '.icon-close',
    '#icon-close',
    '.btn-close',
    '#btn-close',
    '.close-btn',
    '#close-btn',

    // Common class and ID patterns for close buttons
    'button[class*="close"]',
    'button[id*="close"]',
    'button[class*="dismiss"]',
    'button[id*="dismiss"]',
    'button[class*="cancel"]',
    'button[id*="cancel"]',
    '.closeButton',
    '#closeButton',
    '.close-button',
    '#close-button',
    '.dismissButton',
    '#dismissButton',
    '.dismiss-button',
    '#dismiss-button',
    '.cancelButton',
    '#cancelButton',
    '.cancel-button',
    '#cancel-button',

    // Buttons with close icons (×, X)
    'button:has(.fa-times)',
    'button:has(.fa-close)',
    'button:has(.icon-close)',
    'button:has(.close-icon)',
    '.fa-times',
    '.fa-close',
    '.icon-times',
    '.icon-close',
    '#close-popup',
    'close-popup',

    // For bootstrap modals
    '.btn-secondary',
    '[data-dismiss="modal"]',
    '[data-bs-dismiss="modal"]',

    // Generic dismiss/skip patterns for marketing popups
    '.no-thanks',
    '#no-thanks',
    '.not-now',
    '#not-now',
    '.maybe-later',
    '#maybe-later',
    '.skip-offer',
    '#skip-offer',
    '.skip-discount',
    '#skip-discount',
    '.dismiss-offer',
    '#dismiss-offer',
  ]

  // "Never show again" / "Don't show again" checkbox patterns
  const dontShowSelectors = [
    'input[id*="dont-show"]',
    'input[id*="dont_show"]',
    'input[id*="dontShow"]',
    'input[id*="never-show"]',
    'input[id*="never_show"]',
    'input[id*="neverShow"]',
    'input[id*="no-show"]',
    'input[id*="no_show"]',
    'input[id*="noShow"]',
    'label:has-text("Don\'t show again")',
    'label:has-text("Never show again")',
    'label:has-text("Don\'t show this again")',
    'label:has-text("Do not show again")',
    '.dont-show-again',
    '#dont-show-again',
    '.never-show-again',
    '#never-show-again',
  ]

  let popupFound = false
  let closeButtonFound = false

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
          await page.waitForTimeout(500) // Wait for animation
          return true
        }
      } catch (e:any) {
        console.warn(`Click strategy failed on ${description}: ${e.message}`)
      }
    }

    console.warn(`All click strategies failed for ${description}`)
    return false
  }

  // Strategy 1: Try to find a popup first, then look for close buttons within it
  for (const popupSelector of popupSelectors) {
    try {
      const popup = await page.$(popupSelector)
      if (popup) {
        console.log(`Found popup with selector: ${popupSelector}`)
        popupFound = true

        // Try to check "Don't show again" checkbox if it exists
        for (const dontShowSelector of dontShowSelectors) {
          try {
            const checkbox = await popup.$(dontShowSelector)
            if (checkbox) {
              console.log(
                `Found "Don't show again" checkbox with selector: ${dontShowSelector}`
              )
              // Check if it's not already checked
              const isChecked = await checkbox.evaluate((el: Element) => {
                if (el instanceof HTMLInputElement) return el.checked
                return false
              })

              if (!isChecked) {
                await checkbox.click()
                console.log(`Checked "Don't show again" checkbox`)
              } else {
                console.log(`"Don't show again" checkbox was already checked`)
              }
              break
            }
          } catch (e:any) {
            // Continue to next selector
          }
        }

        // Look for close buttons within this popup
        for (const closeSelector of closeSelectors) {
          try {
            const closeButton = await popup.$(closeSelector)
            if (closeButton) {
              console.log(
                `Found close button with selector: ${closeSelector} within popup`
              )
              if (
                await attemptClick(
                  closeButton,
                  `${closeSelector} within ${popupSelector}`
                )
              ) {
                closeButtonFound = true
                break
              }
            }
          } catch (e:any) {
            // Continue to next close selector
          }
        }

        if (closeButtonFound) break
      }
    } catch (e:any) {
      // Continue to next popup selector
    }
  }

  // Strategy 2: If no popup was found or no button was clicked within a popup,
  // try looking for close buttons directly
  if (!closeButtonFound) {
    for (const closeSelector of closeSelectors) {
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
        }, closeSelector)

        if (isVisible) {
          console.log(
            `Found visible close button with selector: ${closeSelector}`
          )
          try {
            const element = await page.$(closeSelector)
            if (element) {
              if (await attemptClick(element, closeSelector)) {
                closeButtonFound = true
                break
              }
            }
          } catch (e:any) {
            console.warn(
              `Error handling close button with selector ${closeSelector}: ${e.message}`
            )
          }
        }
      } catch (e:any) {
        console.warn(
          `Error evaluating visibility for ${closeSelector}: ${e.message}`
        )
      }
    }
  }

  // Strategy 3: Check for and handle popups inside iframes
  if (!closeButtonFound) {
    console.log('Checking for popups inside iframes...')
    const frames = page.frames()
    for (const frame of frames) {
      // Skip main frame
      if (frame === page.mainFrame()) continue

      try {
        // First check if this might be a popup iframe by URL or name
        const frameName = await frame.name()
        const frameUrl = frame.url()

        if (
          frameName.toLowerCase().includes('popup') ||
          frameName.toLowerCase().includes('modal') ||
          frameName.toLowerCase().includes('newsletter') ||
          frameName.toLowerCase().includes('subscribe') ||
          frameUrl.toLowerCase().includes('popup') ||
          frameUrl.toLowerCase().includes('modal') ||
          frameUrl.toLowerCase().includes('newsletter') ||
          frameUrl.toLowerCase().includes('subscribe')
        ) {
          console.log(`Found potential popup iframe: ${frameName || frameUrl}`)

          // Try to check "Don't show again" checkbox if it exists
          for (const dontShowSelector of dontShowSelectors) {
            try {
              const checkboxExists = await frame.$(dontShowSelector)
              if (checkboxExists) {
                console.log(
                  `Found "Don't show again" checkbox in iframe with selector: ${dontShowSelector}`
                )
                try {
                  await frame.click(dontShowSelector, {timeout: 2000})
                  console.log(`Checked "Don't show again" checkbox in iframe`)
                } catch (e:any) {
                  console.warn(
                    `Failed to check "Don't show again" checkbox in iframe: ${e.message}`
                  )
                }
                break
              }
            } catch (e:any) {
              // Continue to next selector
            }
          }

          // Look for close buttons in this frame
          for (const closeSelector of closeSelectors) {
            try {
              const buttonExists = await frame.$(closeSelector)
              if (buttonExists) {
                console.log(
                  `Found close button in iframe with selector: ${closeSelector}`
                )
                try {
                  await frame.click(closeSelector, {timeout: 2000})
                  console.log('Successfully clicked close button in iframe')
                  closeButtonFound = true
                  await page.waitForTimeout(500)
                  break
                } catch (e:any) {
                  console.warn(`Failed to click button in iframe: ${e.message}`)
                  // Try force click as fallback
                  try {
                    await frame.click(closeSelector, {
                      force: true,
                      timeout: 2000,
                    })
                    console.log(
                      'Successfully force-clicked close button in iframe'
                    )
                    closeButtonFound = true
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

          if (closeButtonFound) break
        }
      } catch (e:any) {
        console.warn(`Error checking iframe: ${e.message}`)
      }
    }
  }

  // Strategy 4: Try pressing Escape key to close modals
  if (!closeButtonFound) {
    console.log('Trying to close popup with Escape key...')
    try {
      await page.keyboard.press('Escape')

      // Wait a moment and check if any modals disappeared
      await page.waitForTimeout(500)
      const popupStillExists = await page.evaluate((selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (
            element &&
            window.getComputedStyle(element).display !== 'none' &&
            window.getComputedStyle(element).visibility !== 'hidden' &&
            window.getComputedStyle(element).opacity !== '0'
          ) {
            return true
          }
        }
        return false
      }, popupSelectors)

      if (!popupStillExists) {
        console.log('Successfully closed popup with Escape key')
        closeButtonFound = true
      } else {
        console.log('Escape key did not close popup')
      }
    } catch (e:any) {
      console.warn(`Error while pressing Escape key: ${e.message}`)
    }
  }

  // Strategy 5: Try more generic approaches as a last resort
  if (!closeButtonFound) {
    console.log('Trying generic approach for popups...')

    // Look for elements that might be close buttons based on text or position
    try {
      // 5.1: Check for elements positioned at the corners (likely close buttons)
      console.log(
        'Looking for elements positioned at corners that might be close buttons...'
      )

      const cornerElements = await page.evaluate(() => {
        const results = []
        // Get all elements that might be clickable
        const elements = document.querySelectorAll('button, a, span, div, i')

        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight

        for (const el of elements) {
          const rect = el.getBoundingClientRect()

          // Skip elements that aren't visible
          if (rect.width === 0 || rect.height === 0) continue

          const style = window.getComputedStyle(el)
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0'
          )
            continue

          // Check if element is in a corner
          const isInTopRight = rect.right > viewportWidth - 80 && rect.top < 80
          const isInTopLeft = rect.left < 80 && rect.top < 80
          const isSmall = rect.width < 50 && rect.height < 50

          if ((isInTopRight || isInTopLeft) && isSmall) {
            // Look for common traits of close buttons
            const hasCloseText =
              el.textContent?.trim() === 'X' ||
              el.textContent?.trim() === '×' ||
              el.textContent?.trim() === 'Close'

            const hasCloseIcon =
              el.innerHTML?.includes('times') ||
              el.innerHTML?.includes('close') ||
              el.innerHTML?.includes('&#215;') || // × character
              el.innerHTML?.includes('&times;')

            const isLikelyCloseButton =
              hasCloseText ||
              hasCloseIcon ||
              el.className?.toLowerCase().includes('close') ||
              el.id?.toLowerCase().includes('close')

            if (isLikelyCloseButton) {
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
                  const classes = node.className.split(/\s+/).filter(Boolean)
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
                text: el.textContent || '',
                selector: path || '',
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
              })
            }
          }
        }
        return results
      })

      // Try to click the potential elements
      for (const el of cornerElements) {
        console.log(
          `Found potential corner close button: "${el.text}" at selector: ${el.selector}`
        )
        try {
          if (el.selector) {
            const element = await page.$(el.selector)
            if (element) {
              if (
                await attemptClick(
                  element,
                  `"${el.text}" corner element with selector ${el.selector}`
                )
              ) {
                closeButtonFound = true
                break
              }
            }
          }

          // Fallback to position click if selector failed
          if (!closeButtonFound && el.x && el.y) {
            console.log(
              `Attempting position click at ${el.x},${el.y} for "${el.text}"`
            )
            await page.mouse.click(el.x, el.y)
            console.log(`Successfully clicked at position ${el.x},${el.y}`)
            closeButtonFound = true
            await page.waitForTimeout(500)
            break
          }
        } catch (e:any) {
          console.warn(
            `Failed to click potential corner close button: ${e.message}`
          )
        }
      }

      // 5.2: Look for backdrop/overlay clicks if still not successful
      if (!closeButtonFound) {
        console.log(
          'Looking for backdrop/overlay elements that might close the popup when clicked...'
        )

        const backdropSelectors = [
          '.modal-backdrop',
          '#modal-backdrop',
          '.modal-overlay',
          '#modal-overlay',
          '.popup-backdrop',
          '#popup-backdrop',
          '.popup-overlay',
          '#popup-overlay',
          '.overlay',
          '#overlay',
          '.backdrop',
          '#backdrop',
          '[class*="modal-backdrop"]',
          '[class*="modal-overlay"]',
          '[class*="popup-backdrop"]',
          '[class*="popup-overlay"]',
        ]

        for (const backdropSelector of backdropSelectors) {
          try {
            const backdrop = await page.$(backdropSelector)
            if (backdrop) {
              console.log(
                `Found potential backdrop with selector: ${backdropSelector}`
              )
              if (await attemptClick(backdrop, backdropSelector)) {
                closeButtonFound = true
                break
              }
            }
          } catch (e:any) {
            // Continue to next selector
          }
        }
      }
    } catch (e:any) {
      console.warn(`Error in generic popup handling approach: ${e.message}`)
    }
  }

  // Strategy 6: Click outside/around the popup as last resort
  if (!closeButtonFound && popupFound) {
    console.log('Attempting to click outside popup to dismiss it...')
    try {
      // Get the popup dimensions
      const popupBounds = await page.evaluate((popupSelectors) => {
        for (const selector of popupSelectors) {
          const popup = document.querySelector(selector)
          if (popup) {
            const rect = popup.getBoundingClientRect()
            return {
              left: rect.left,
              top: rect.top,
              right: rect.right,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
            }
          }
        }
        return null
      }, popupSelectors)

      if (popupBounds) {
        // Get viewport dimensions
        const viewportDims = await page.evaluate(() => {
          return {
            width: window.innerWidth,
            height: window.innerHeight,
          }
        })

        // Find positions outside the popup to click
        const clickPositions = [
          // Bottom-center
          {x: viewportDims.width / 2, y: viewportDims.height - 20},
          // Top-center
          {x: viewportDims.width / 2, y: 20},
          // Mid-left
          {x: 20, y: viewportDims.height / 2},
          // Mid-right
          {x: viewportDims.width - 20, y: viewportDims.height / 2},
        ]

        // Filter positions to ensure they're outside the popup
        const validPositions = clickPositions.filter(
          (pos) =>
            pos.x < popupBounds.left - 10 ||
            pos.x > popupBounds.right + 10 ||
            pos.y < popupBounds.top - 10 ||
            pos.y > popupBounds.bottom + 10
        )

        // Try clicking outside positions
        for (const pos of validPositions) {
          console.log(
            `Attempting to click outside popup at position: x=${pos.x}, y=${pos.y}`
          )
          await page.mouse.click(pos.x, pos.y)
          await page.waitForTimeout(500)

          // Check if popup is still visible
          const popupStillVisible = await page.evaluate((popupSelectors) => {
            for (const selector of popupSelectors) {
              const popup = document.querySelector(selector)
              if (
                popup &&
                window.getComputedStyle(popup).display !== 'none' &&
                window.getComputedStyle(popup).visibility !== 'hidden' &&
                window.getComputedStyle(popup).opacity !== '0'
              ) {
                return true
              }
            }
            return false
          }, popupSelectors)

          if (!popupStillVisible) {
            console.log('Successfully dismissed popup by clicking outside')
            closeButtonFound = true
            break
          }
        }
      }
    } catch (e:any) {
      console.warn(`Error while trying to click outside popup: ${e.message}`)
    }
  }

  // Report results
  if (popupFound || closeButtonFound) {
    console.log(
      `Popup handling results: Popup found: ${popupFound}, Successfully closed: ${closeButtonFound}`
    )
  } else {
    console.log('No popups detected or no close buttons could be clicked')
  }

  return
}

export default handlePopups
