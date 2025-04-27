import type { Page, Frame, ElementHandle, Locator } from 'playwright';
import { logger } from './logger.js'; // Added .js extension

// --- Constants ---
const CLICK_TIMEOUT = 2000; // Timeout for click attempts
const POST_CLICK_DELAY = 500; // Delay after successful click
const VISIBILITY_TIMEOUT = 500; // Short timeout for visibility checks
const IFRAME_LOAD_TIMEOUT = 2500; // Timeout for waiting for iframe content
const SETTLE_DELAY = 250; // Brief delay before starting checks

// --- Selectors (Moved outside for clarity and potential reuse) ---
// Using case-insensitive matching ('i') where appropriate
const BANNER_SELECTORS = [
  // Standard containers
  '#cookie-banner', '.cookie-banner', '#cookieBanner', '.cookie-consent', '#cookie-consent', '#cookieConsent',
  '.cookie-notice', '#cookie-notice', '#cookieNotice', '.cookies-banner', '#cookies-banner', '#cookiesBanner',
  // GDPR containers
  '.gdpr-banner', '#gdpr-banner', '#gdprBanner', '.gdpr-consent', '#gdpr-consent', '#gdprConsent',
  '.gdpr-notice', '#gdpr-notice',
  // Common class patterns
  '[class*="cookie-banner" i]', '[class*="cookie_banner" i]', '[class*="cookieBanner" i]',
  '[class*="cookie-consent" i]', '[class*="cookie_consent" i]', '[class*="cookieConsent" i]',
  '[class*="cookie-notice" i]', '[class*="cookie_notice" i]', '[class*="cookieNotice" i]',
  '[class*="gdpr-banner" i]', '[class*="gdpr_banner" i]', '[class*="gdprBanner" i]',
  // General privacy notices
  '.privacy-notice', '#privacy-notice', '.privacy-banner', '#privacy-banner',
  '.consent-banner', '#consent-banner', '.consent-modal', '#consent-modal',
  // Dynamic IDs
  '[id*="cookie-banner" i]', '[id*="cookie_banner" i]', '[id*="cookieBanner" i]',
  '[id*="cookie-consent" i]', '[id*="cookie_consent" i]', '[id*="cookieConsent" i]',
  // Common root/overlay elements
  '#cmp-app-container', '#cmp-container', '#usercentrics-root', '#onetrust-consent-sdk'
];

const ACCEPT_SELECTORS = [
  // Direct text matching (using Playwright's text engine, case-insensitive)
  'button:text-matches("Accept", "i")', 'button:text-matches("Accept All", "i")', 'button:text-matches("I Accept", "i")',
  'button:text-matches("Allow All", "i")', 'button:text-matches("Allow Cookies", "i")', 'button:text-matches("Accept Cookies", "i")',
  'button:text-matches("I Agree", "i")', 'button:text-matches("Agree", "i")', 'button:text-matches("Agree to All", "i")',
  'button:text-matches("Continue", "i")', 'button:text-matches("Allow", "i")', 'button:text-matches("Got it", "i")',
  'a:text-matches("Accept", "i")', 'a:text-matches("Accept All", "i")', 'a:text-matches("I Accept", "i")', 'a:text-matches("Allow All", "i")',
  'a:text-matches("Agree", "i")', 'a:text-matches("OK", "i")',
  // Common ID/Class patterns (case-insensitive)
  'button[id*="accept" i]', 'button[class*="accept" i]', 'button[id*="agree" i]', 'button[class*="agree" i]',
  'button[id*="allow" i]', 'button[class*="allow" i]', 'button[id*="consent" i]', 'button[class*="consent" i]',
  'button[id*="cookie-accept" i]', 'button[class*="cookie-accept" i]',
  '[class*="accept-cookies" i]', '[id*="accept-cookies" i]', '[class*="accept-all" i]', '[id*="accept-all" i]', '[class*="acceptAll" i]', '[id*="acceptAll" i]',
  '[class*="accept" i]', '[id*="accept" i]', '[class*="agree" i]', '[id*="agree" i]',
  // Less specific patterns
  '[class*="btn-accept" i]', '[id*="btn-accept" i]', '[class*="btn-agree" i]', '[id*="btn-agree" i]', '[class*="accept-btn" i]', '[id*="accept-btn" i]',
  '[class*="agree-btn" i]', '[id*="agree-btn" i]', '[class*="consent-btn" i]', '[id*="consent-btn" i]', '[class*="btn-consent" i]', '[id*="btn-consent" i]',
  // Form elements
  'input[type="submit"][value*="Accept" i]', 'input[type="button"][value*="Accept" i]',
  'input[type="submit"][value*="Agree" i]', 'input[type="button"][value*="Agree" i]',
  // Role-based
  '[role="button"]:text-matches("Accept", "i")', '[role="button"]:text-matches("Accept All", "i")',
  '[role="button"]:text-matches("Allow", "i")', '[role="button"]:text-matches("Agree", "i")',
];

// --- Helper Functions ---

/**
 * Attempts to click an element using multiple strategies (standard, force, JS).
 * Uses Playwright Locators for robustness.
 * @param locator The Playwright Locator to click.
 * @param description A description for logging purposes.
 * @param page The Playwright Page object.
 * @returns Promise<boolean> True if clicked successfully, false otherwise.
 */
async function attemptClick(
  locator: Locator,
  description: string,
  page: Page
): Promise<boolean> {
  let element: ElementHandle | null = null;
  try {
    // Try to get element handle for JS click, but don't fail if it's not immediately available
    element = await locator.elementHandle({ timeout: VISIBILITY_TIMEOUT / 2 }).catch(() => null);
  } catch (e) {
    logger.debug(`Non-critical element handle error for ${description}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
  }

  const strategies = [
    // Strategy 1: Standard click (via Locator) - Preferred
    async () => {
      logger.debug(`Attempting standard click on ${description}...`);
      await locator.click({ timeout: CLICK_TIMEOUT });
      return true;
    },
    // Strategy 2: Force click (via Locator) - If standard fails (e.g., covered)
    async () => {
      logger.debug(`Attempting force click on ${description}...`);
      await locator.click({ force: true, timeout: CLICK_TIMEOUT });
      return true;
    },
    // Strategy 3: JS click (via ElementHandle) - Fallback if locator clicks fail
    async () => {
      if (!element) {
        logger.debug(`Skipping JS click on ${description} (no element handle).`);
        return false; // Cannot perform JS click without handle
      }
      logger.debug(`Attempting JS click on ${description}...`);
      await element.evaluate((el: Element) => (el as HTMLElement).click());
      await page.waitForTimeout(100); // JS click doesn't always wait for consequences
      return true;
    },
  ];

  for (const strategy of strategies) {
    try {
      if (await strategy()) {
        logger.info(`Successfully clicked ${description}`);
        await page.waitForTimeout(POST_CLICK_DELAY); // Wait for potential banner disappearance/animations
        await waitForElementHidden(locator, description);
        await element?.dispose(); // Clean up handle if we got one
        return true; // Click succeeded
      }
    } catch (e: any) {
      const message = e.message?.split('\n')[0] ?? 'Unknown click error';
      // Avoid logging excessive timeouts or common non-errors during attempts
      if (!message.includes('Timeout') && !message.includes('locator resolves to hidden') && !message.includes('Target closed')) {
        logger.warn(`Click strategy failed for ${description}: ${message}`);
      } else {
        logger.debug(`Click strategy failed for ${description}: ${message}`);
      }
    }
  }

  logger.warn(`All click strategies failed for ${description}`);
  await element?.dispose(); // Clean up handle if we got one
  return false; // All strategies failed
}

async function waitForElementHidden(locator: Locator, description: string) {
  try {
    await locator.waitFor({ state: 'hidden', timeout: 1000 });
    logger.debug(`${description} became hidden after click.`);
  } catch (e) {
    // Element might still be present but non-interactive, or page navigated. This is often OK.
    logger.debug(`${description} might still be present/visible after click.`);
    throw e;
  }
}

/**
 * Tries to find and click an accept button within a specific scope (page, frame, or locator).
 * Iterates through ACCEPT_SELECTORS and uses attemptClick.
 * @param scope The Page, Frame, or Locator to search within.
 * @param description Context description for logging (e.g., "main page", "iframe 'consent-frame'").
 * @param page The Playwright Page object (required for attemptClick).
 * @returns Promise<boolean> True if a button was successfully clicked, false otherwise.
 */
async function findAndClickButtonInScope(
    scope: Page | Frame | Locator,
    description: string,
    page: Page // Added page parameter directly
): Promise<boolean> {

  for (const selector of ACCEPT_SELECTORS) {
    try {
      // Use locator chaining: scope.locator(selector) finds elements within the scope
      const buttonLocator = scope.locator(selector).first(); // Target the first match

      // Check visibility efficiently using the locator's built-in check
      if (await buttonLocator.isVisible({ timeout: VISIBILITY_TIMEOUT })) {
        logger.info(`Found potential button: ${selector} in ${description}`);
        if (await attemptClick(buttonLocator, `${selector} in ${description}`, page)) {
          return true; // Success! Button clicked.
        }
        // If attemptClick failed, continue to the next selector
      }
    } catch (e: any) {
      // Ignore common errors like timeouts or element not found during the search
      const message = e.message?.split('\n')[0] ?? '';
      if (!(message.includes('Timeout') || message.includes('Target closed') || message.includes('frame was detached') || message.includes('No node found for selector'))) {
         logger.debug(`Error finding/checking ${selector} in ${description}: ${message}`);
      }
    }
  }
  logger.debug(`No suitable accept button found in ${description} after checking all selectors.`);
  return false; // No button found or clicked in this scope after trying all selectors
}


/**
 * Strategy 1: Find a known banner element, then click an accept button within it.
 * Increases likelihood by scoping the search.
 */
async function tryClickInBanner(page: Page): Promise<boolean> {
  logger.debug('Strategy 1: Searching for known banner elements...');
  for (const bannerSelector of BANNER_SELECTORS) {
    try {
      const bannerLocator = page.locator(bannerSelector).first();
      if (await bannerLocator.isVisible({ timeout: VISIBILITY_TIMEOUT })) {
        logger.info(`Found potential banner container: ${bannerSelector}`);
        // Try clicking buttons scoped within this banner locator, passing page
        if (await findAndClickButtonInScope(bannerLocator, `banner ${bannerSelector}`, page)) {
             return true; // Success
        }
        // If no button found in this banner, continue to the next banner selector
      }
    } catch (e: any) {
       // Ignore errors finding a specific banner and try the next one
       const message = e.message?.split('\n')[0] ?? '';
       if (!(message.includes('Timeout') || message.includes('Target closed'))) {
         logger.debug(`Error finding/checking banner ${bannerSelector}: ${message}`);
       }
    }
  }
  logger.debug('Strategy 1: No known banner found containing a clickable accept button.');
  return false;
}

/**
 * Strategy 2: Find an accept button directly on the page (not necessarily in a known banner).
 * Catches buttons in less standard containers.
 */
async function tryClickDirectButton(page: Page): Promise<boolean> {
  logger.debug('Strategy 2: Searching for direct accept buttons on page...');
  // Pass page object
  return findAndClickButtonInScope(page, 'main page', page);
}

/**
 * Strategy 3: Find and click accept buttons within iframes.
 * Handles consent managers loaded in separate frames.
 */
async function tryClickInIframes(page: Page): Promise<boolean> {
  logger.debug('Strategy 3: Checking iframes for consent banners...');
  const frames = page.frames();
  // Iterate over a copy in case frames detach during iteration
  for (const frame of [...frames]) {
    if (frame.isDetached() || frame === page.mainFrame()) continue; // Skip detached/main frames

    const frameDesc = `iframe "${frame.name() || frame.url()}"`;
    try {
      // Basic check if frame might be relevant (case-insensitive keywords)
      const url = frame.url().toLowerCase();
      const name = frame.name().toLowerCase();
      const isPotentiallyRelevant = ['consent', 'cookie', 'gdpr', 'privacy', 'banner', 'dialog', 'cmp', 'trust', 'onetrust', 'usercentrics'].some(keyword =>
        url.includes(keyword) || name.includes(keyword)
      );

      if (isPotentiallyRelevant) {
        logger.info(`Checking potentially relevant ${frameDesc}`);
        // Wait briefly for frame content, but don't fail hard if it times out
        await frame.waitForLoadState('domcontentloaded', { timeout: IFRAME_LOAD_TIMEOUT }).catch(() => {
            logger.warn(`Timeout waiting for load state in ${frameDesc}, proceeding anyway...`);
        });

        // Use the frame as the scope for finding buttons, passing page
        if (await findAndClickButtonInScope(frame, frameDesc, page)) {
          logger.info(`Handled consent in ${frameDesc}`);
          return true; // Success
        }
      } else {
         logger.debug(`Skipping irrelevant ${frameDesc}`);
      }
    } catch (e: any) {
      // Ignore errors (e.g., frame detached during processing, security restrictions)
       const message = e.message?.split('\n')[0] ?? '';
       if (!(message.includes('Timeout') || message.includes('Target closed') || message.includes('frame was detached'))) {
         logger.warn(`Error processing ${frameDesc}: ${message}`);
       }
    }
  }
  logger.debug('Strategy 3: No consent banner handled in any iframe.');
  return false;
}


// --- Main Exported Function ---

/**
 * Attempts to detect and handle cookie consent banners using multiple strategies.
 * Refactored for lower complexity, better maintainability, and robustness using Playwright Locators.
 * @param page Playwright Page object
 * @returns Promise that resolves when cookie handling is attempted (does not guarantee success).
 */
export async function handleCookieBanners(page: Page): Promise<void> {
  logger.info('Attempting to handle cookie consent banners...');

  try {
    // Give the page a brief moment to settle in case banners animate in
    await page.waitForTimeout(SETTLE_DELAY);

    // --- Execute Strategies Sequentially ---

    // Strategy 1: Look for buttons within known banner containers
    if (await tryClickInBanner(page)) {
      logger.info('Cookie banner likely handled via Strategy 1 (Banner Scope).');
      return; // Handled
    }

    // Strategy 2: Look for accept buttons directly on the page
    if (await tryClickDirectButton(page)) {
      logger.info('Cookie banner likely handled via Strategy 2 (Direct Button).');
      return; // Handled
    }

    // Strategy 3: Look for accept buttons within iframes
    if (await tryClickInIframes(page)) {
      logger.info('Cookie banner likely handled via Strategy 3 (IFrame).');
      return; // Handled
    }

    // Strategy 4 (Final Pass): Re-run direct button check. Sometimes banners/buttons
    // appear late or after initial checks fail. This replaces the complex/brittle DOM scan.
    logger.debug('Strategy 4: Final pass for direct accept buttons...');
    // Pass page object
    if (await findAndClickButtonInScope(page, 'main page (final pass)', page)) {
         logger.info('Cookie banner likely handled via Strategy 4 (Final Pass).');
         return; // Handled
    }

    // --- End of Strategies ---
    logger.info('Could not find or handle any cookie banners after all strategies.');

  } catch (error: any) {
    // Catch unexpected errors in the orchestration logic itself
    logger.error(`Unexpected error during cookie handling orchestration: ${error.message}`, error);
    // Optionally re-throw if the caller needs to know about critical failures
    // throw error;
  }
}

// Optional: Export helper functions if they might be useful elsewhere,
// otherwise keep them internal to this module.
// export { attemptClick, findAndClickButtonInScope };
