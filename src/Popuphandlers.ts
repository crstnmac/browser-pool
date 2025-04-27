import type {Page, Frame, ElementHandle} from 'playwright'
import {logger} from './logger.js' // Assuming logger is available

// --- Selectors (Moved outside for clarity) ---

// Common popup container selectors - ordered by specificity and frequency
const POPUP_SELECTORS = [
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
const CLOSE_SELECTORS = [
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
  'button:has-text("×")', // Unicode multiplication sign often used as close
  'button:has-text("X")', // Uppercase X
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
  // Buttons with close icons (×, X) using common icon libraries/classes
  'button:has(.fa-times)',
  'button:has(.fa-close)',
  'button:has(.icon-close)',
  'button:has(.close-icon)',
  '.fa-times', // FontAwesome icon class
  '.fa-close', // FontAwesome icon class (alias)
  '.icon-times',
  '.icon-close',
  '#close-popup',
  '.close-popup', // Class instead of ID
  // For bootstrap modals
  '.btn-secondary', // Often used for cancel/close
  '[data-dismiss="modal"]', // Bootstrap 4
  '[data-bs-dismiss="modal"]', // Bootstrap 5
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
const DONT_SHOW_SELECTORS = [
  'input[type="checkbox"][id*="dont-show"]',
  'input[type="checkbox"][id*="dont_show"]',
  'input[type="checkbox"][id*="dontShow"]',
  'input[type="checkbox"][id*="never-show"]',
  'input[type="checkbox"][id*="never_show"]',
  'input[type="checkbox"][id*="neverShow"]',
  'input[type="checkbox"][id*="no-show"]',
  'input[type="checkbox"][id*="no_show"]',
  'input[type="checkbox"][id*="noShow"]',
  'label:has-text("Don\'t show again")',
  'label:has-text("Never show again")',
  'label:has-text("Don\'t show this again")',
  'label:has-text("Do not show again")',
  '.dont-show-again input[type="checkbox"]',
  '#dont-show-again input[type="checkbox"]',
  '.never-show-again input[type="checkbox"]',
  '#never-show-again input[type="checkbox"]',
  'input[name*="dont_show"]', // Check name attribute too
  'input[name*="never_show"]',
]

// Backdrop selectors
const BACKDROP_SELECTORS = [
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

// --- Helper Functions ---

/**
 * Attempts to click an element using multiple strategies.
 * @param element The ElementHandle to click.
 * @param description A description for logging purposes.
 * @param context The Page or Frame context.
 * @returns Promise resolving to true if click was successful, false otherwise.
 */
async function attemptClick(
  element: ElementHandle,
  description: string,
  context: Page | Frame
): Promise<boolean> {
  const strategies = [
    async () => {
      logger.debug(`Attempting standard click on ${description}...`)
      await element.click({timeout: 3000})
      return true
    },
    async () => {
      logger.debug(`Attempting force click on ${description}...`)
      await element.click({force: true, timeout: 3000})
      return true
    },
    async () => {
      logger.debug(`Attempting JS click on ${description}...`)
      await element.evaluate((el: Element) => (el as HTMLElement).click())
      return true
    },
    async () => {
      // Type guard: Ensure context is Page before accessing 'mouse'
      if ('mouse' in context) {
          logger.debug(`Attempting centered click on ${description}...`)
          const box = await element.boundingBox()
          if (box) {
              await context.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
              return true
          }
      } else {
          logger.debug(`Skipping centered click strategy for Frame context on ${description}`)
      }
      return false
    },
  ]

  for (const strategy of strategies) {
    // Skip mouse click strategy if context is a Frame
    if (
      strategy.toString().includes('context.mouse.click') &&
      !('mouse' in context)
    ) {
      logger.debug(`Skipping mouse click strategy for Frame context on ${description}`)
      continue
    }

    try {
      if (await strategy()) {
        logger.info(`Successfully clicked ${description}`)
        // Get the Page object to call waitForTimeout on.
        // If context is Page, use it directly. If Frame, get its parent Page.
        const pageForWait = 'mouse' in context ? context : (context).page();
        await pageForWait.waitForTimeout(500) // Wait for potential animations
        return true
      }
    } catch (e: any) {
      logger.warn(`Click strategy failed for ${description}: ${e.message}`)
    }
  }

  logger.error(`All click strategies failed for ${description}`)
  return false
}

/**
 * Finds the first visible element matching any of the selectors.
 * @param context Page or Frame context.
 * @param selectors Array of CSS selectors.
 * @param description Description for logging.
 * @returns Promise resolving to the ElementHandle or null.
 */
async function findVisibleElement(
  context: Page | Frame,
  selectors: string[],
  description: string
): Promise<ElementHandle | null> {
  for (const selector of selectors) {
    try {
      const element = await context.$(selector)
      if (element && (await element.isVisible())) {
        logger.debug(`Found visible ${description} with selector: ${selector}`)
        return element
      }
    } catch (e: any) {
      logger.warn(
        `Error finding visible ${description} with selector ${selector}: ${e.message}`
      )
    }
  }
  return null
}

/**
 * Checks and clicks the "Don't show again" checkbox if found and not checked.
 * @param popupElement The popup ElementHandle containing the checkbox.
 * @param context Page or Frame context.
 * @returns Promise resolving to true if checkbox was handled, false otherwise.
 */
async function handleDontShowCheckbox(
  popupElement: ElementHandle,
  context: Page | Frame
): Promise<boolean> {
  for (const selector of DONT_SHOW_SELECTORS) {
    try {
      const checkbox = await popupElement.$(selector)
      if (checkbox) {
        logger.debug(
          `Found "Don't show again" checkbox with selector: ${selector}`
        )
        if (!(await checkbox.isChecked())) {
          await attemptClick(
            checkbox,
            `"Don't show again" checkbox (${selector})`,
            context
          )
          logger.info(`Checked "Don't show again" checkbox (${selector})`)
        } else {
          logger.debug(
            `"Don't show again" checkbox (${selector}) was already checked`
          )
        }
        return true // Handled (found it, checked or not)
      }
    } catch (e: any) {
      logger.warn(
        `Error handling "Don't show again" checkbox (${selector}): ${e.message}`
      )
    }
  }
  return false // Not found
}

/**
 * Checks if any popup is still visible on the page.
 * @param page Playwright Page object.
 * @returns Promise resolving to true if a popup is visible, false otherwise.
 */
async function isPopupVisible(page: Page): Promise<boolean> {
  return page.evaluate((selectors) => {
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
  }, POPUP_SELECTORS)
}

// --- Core Logic Functions ---

/**
 * Tries to find and close a popup within a given context (Page or Frame).
 * Handles "Don't show again" checkbox.
 * @param context Page or Frame context.
 * @returns Promise resolving to true if a popup was found and closed, false otherwise.
 */
async function findAndCloseInContext(
  context: Page | Frame
): Promise<boolean> {
  const popup = await findVisibleElement(context, POPUP_SELECTORS, 'popup')
  if (!popup) {
    return false // No visible popup found in this context
  }

  logger.info(`Found popup in context: ${context.url()}`)
  await handleDontShowCheckbox(popup, context)

  // Search for close button *within* the popup element
  for (const selector of CLOSE_SELECTORS) {
      try {
          const closeButton = await popup.$(selector);
          if (closeButton && await closeButton.isVisible()) {
              logger.debug(`Found visible close button with selector: ${selector} within popup`);
              return attemptClick(
                  closeButton,
                  `close button (${selector}) within popup`,
                  context
              );
          }
      } catch (e: any) {
          logger.warn(`Error finding/checking close button ${selector} within popup: ${e.message}`);
      }
  }

  logger.warn('Could not find a visible close button within the detected popup.')
  // Optionally, try clicking the popup itself as a last resort for this context?
  // return attemptClick(popup, 'popup element itself', context);
  return false;
}

/**
 * Tries to find and click a close button directly on the page (not necessarily within a detected popup).
 * @param page Playwright Page object.
 * @returns Promise resolving to true if a close button was found and clicked, false otherwise.
 */
async function findAndClickCloseButtonDirectly(page: Page): Promise<boolean> {
  logger.debug('Attempting to find close buttons directly on the page...')
  const closeButton = await findVisibleElement(
    page,
    CLOSE_SELECTORS,
    'direct close button'
  )
  if (closeButton) {
    return attemptClick(closeButton, 'direct close button', page)
  }
  return false
}

/**
 * Handles popups within iframes.
 * @param page Playwright Page object.
 * @returns Promise resolving to true if a popup was found and closed in an iframe, false otherwise.
 */
async function handlePopupsInIframes(page: Page): Promise<boolean> {
  logger.debug('Checking for popups inside iframes...')
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue // Skip main frame

    try {
      // Basic check if frame might contain a popup based on name/URL
      const frameName = frame.name() // Returns string directly
      const frameUrl = frame.url()
      const potentialPopupKeywords = ['popup', 'modal', 'newsletter', 'subscribe', 'ads', 'form'] // Added ads/form
      const isPotentialPopupFrame =
        potentialPopupKeywords.some(keyword => frameName.toLowerCase().includes(keyword)) ||
        potentialPopupKeywords.some(keyword => frameUrl.toLowerCase().includes(keyword))

      if (isPotentialPopupFrame) {
         logger.debug(`Checking potential popup iframe: ${frameName || frameUrl}`)
         // Check frame visibility/readiness before interacting
         const isVisible = await frame.evaluate(() => {
            // Basic visibility check for the frame's document body
            return document.body && window.getComputedStyle(document.body).display !== 'none';
         }).catch(() => false);

         if (isVisible && await findAndCloseInContext(frame)) {
            logger.info(`Closed popup in iframe: ${frameName || frameUrl}`)
            return true // Closed popup in this frame
         }
      }
    } catch (e: any) {
      // Log errors accessing frame details, but continue checking others
      if (e.message.includes('frame was detached')) {
        logger.warn(`Iframe detached while checking: ${frame.url()}`);
      } else {
        logger.error(`Error checking iframe ${frame.url()}: ${e.message}`)
      }
    }
  }
  return false // No popup closed in any iframe
}

/**
 * Tries generic methods like Escape key, backdrop click, or clicking outside.
 * @param page Playwright Page object.
 * @returns Promise resolving to true if a popup was likely closed, false otherwise.
 */
async function tryGenericCloseMethods(page: Page): Promise<boolean> {
  logger.debug('Trying generic popup close methods...')

  // 1. Try Escape Key
  try {
    logger.debug('Trying Escape key...')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
    if (!(await isPopupVisible(page))) {
      logger.info('Popup likely closed with Escape key.')
      return true
    }
  } catch (e: any) {
    logger.warn(`Error pressing Escape key: ${e.message}`)
  }

  // 2. Try clicking backdrop
  logger.debug('Trying to click backdrop/overlay...')
  const backdrop = await findVisibleElement(
    page,
    BACKDROP_SELECTORS,
    'backdrop/overlay'
  )
  if (backdrop && (await attemptClick(backdrop, 'backdrop/overlay', page))) {
    if (!(await isPopupVisible(page))) {
       logger.info('Popup likely closed by clicking backdrop.')
       return true
    }
  }

  // 3. Try clicking outside (if a popup was initially detected)
  // This is less reliable and might interact unintentionally, use cautiously.
  // Consider adding a flag if a popup was *ever* detected to enable this.
  // For now, keeping it simple and omitting the complex 'click outside' logic
  // which had high potential for errors and complexity. If needed, it can be
  // added back as a separate, well-contained function.

  // 4. Corner click logic could be added here if necessary, but it's complex
  // and prone to false positives.

  return false
}

// --- Main Exported Function ---

/**
 * Comprehensive function to detect and handle various popups and modal dialogs.
 * @param page Playwright Page object.
 * @returns Promise that resolves when popup handling is complete.
 */
async function handlePopups(page: Page): Promise<void> {
  logger.info('Attempting to handle popups and dialogs...')
  let closed = false

  try {
    // Strategy 1: Find popup in main page context first
    closed = await findAndCloseInContext(page)

    // Strategy 2: If not found/closed, look for direct close buttons
    if (!closed) {
      closed = await findAndClickCloseButtonDirectly(page)
    }

    // Strategy 3: If not closed, check iframes
    if (!closed) {
      closed = await handlePopupsInIframes(page)
    }

    // Strategy 4: If still not closed, try generic methods
    if (!closed && (await isPopupVisible(page))) { // Only try generic if a popup seems present
      closed = await tryGenericCloseMethods(page)
    }

  } catch (error: any) {
    logger.error(`An unexpected error occurred during popup handling: ${error.message}`, error)
  }

  if (closed) {
    logger.info('Popup handling finished: A popup was likely closed.')
  } else {
    logger.info('Popup handling finished: No popup actively closed, or none detected.')
  }
}

export default handlePopups
