import {chromium} from 'playwright-extra'
import {logger} from './logger.js' // Assuming you have a logger module
import type {Browser, Page} from 'playwright'
/**
 * A pool of browsers to manage the creation and reuse of browser pages
 * with a maximum size limit.
 */
class BrowserPool {
  private browserClosed: boolean = false
  private browser: Browser | undefined
  private releasedPages: Page[] = []
  private requiredPages: Page[] = []
  private readonly maxSize: number
  private waitQueue: Array<(value: void | PromiseLike<void>) => void> = [] // Queue for waiting requests
  private browserLaunchPromise: Promise<Browser> | null = null // Lock for launching
  private lastActivityTime: number = Date.now() // Track last activity
  private readonly idleTimeoutMs: number // Timeout duration in ms
  private readonly idleCheckIntervalMs: number // How often to check
  private idleCheckTimer: NodeJS.Timeout | null = null // Timer ID

  /**
   * Initializes a new instance of the BrowserPool class.
   * @param maxSize Maximum number of pages the pool can manage.
   * @param idleTimeoutMs Time in milliseconds before an idle browser is closed.0 disables idle timeout.
   * @param idleCheckIntervalMs How often (in ms) to check for idleness.
   */
  public constructor(
    maxSize: number,
    idleTimeoutMs: number = 0,
    idleCheckIntervalMs: number = 60000
  ) {
    this.maxSize = maxSize
    this.idleTimeoutMs = idleTimeoutMs
    this.idleCheckIntervalMs = Math.max(10000, idleCheckIntervalMs) // Ensure minimum check interval
    logger.info(
      `BrowserPool initialized with maxSize=${maxSize}, idleTimeout=${idleTimeoutMs}ms`
    )

    // Start idle check timer if timeout is enabled
    if (this.idleTimeoutMs > 0) {
      this.idleCheckTimer = setInterval(
        () => this._checkIdleTimeout(),
        this.idleCheckIntervalMs
      )
      // Prevent Node.js from exiting just because this timer is active
      this.idleCheckTimer.unref()
    }
  }

  /**
   * Checks if a given page is being tracked by the pool.
   * @param page The page to check.
   * @returns True if the page is being tracked, false otherwise.
   */
  public isPageTracked(page: Page): boolean {
    return this.requiredPages.includes(page)
  }

  private getCurrentSize(): number {
    return this.requiredPages.length + this.releasedPages.length
  }

  /**
   * Gets a browser instance, launching a new one if necessary, handling concurrent requests.
   * @returns A promise that resolves to a browser instance.
   */
  private async getBrowser(): Promise<Browser> {
    const callId = Math.random().toString(36).substring(2, 8) // Unique ID for this call
    logger.info(`[${callId}] getBrowser ENTER`)

    // If a browser exists and is connected, return it immediately
    if (this.browser && !this.browserClosed && this.browser.isConnected()) {
      logger.info(
        `[${callId}] getBrowser: Returning existing connected browser instance.`
      )
      return this.browser
    }
    logger.info(
      `[${callId}] getBrowser: No usable existing browser (exists: ${!!this
        .browser}, closed: ${
        this.browserClosed
      }, connected: ${this.browser?.isConnected()})`
    )

    // If a launch is already in progress, wait for it
    if (this.browserLaunchPromise) {
      logger.info(
        `[${callId}] getBrowser: Launch promise exists, awaiting its completion...`
      )
      try {
        const launchedBrowser = await this.browserLaunchPromise
        logger.info(
          `[${callId}] getBrowser: Awaited launch promise completed. Browser connected: ${launchedBrowser?.isConnected()}`
        )
        if (launchedBrowser?.isConnected()) {
          logger.info(
            `[${callId}] getBrowser: Returning browser from awaited promise.`
          )
          return launchedBrowser
        } else {
          logger.warn(
            `[${callId}] getBrowser: Awaited launch failed or resulted in disconnected browser. Will attempt a new launch.`
          )
          this.browserLaunchPromise = null // Clear the failed promise
        }
      } catch (error: any) {
        logger.warn(
          `[${callId}] getBrowser: Error awaiting existing launch promise: ${error.message}. Will attempt a new launch.`
        )
        this.browserLaunchPromise = null // Clear the failed promise
      }
    } else {
      logger.info(`[${callId}] getBrowser: No existing launch promise.`)
    }

    // If we reach here, we need to launch a new browser (or retry a failed launch)
    logger.info(
      `[${callId}] getBrowser: Initiating new browser launch sequence...`
    )

    // Create the launch promise and store it *before* starting the launch
    this.browserLaunchPromise = (async () => {
      const launchId = Math.random().toString(36).substring(2, 8) // Unique ID for this launch attempt
      logger.info(`[${callId}] Launch IIFE START [${launchId}]`)
      try {
        // Attempt to close any potentially defunct previous instance
        if (this.browser) {
          try {
            logger.info(
              `[${callId}] Launch IIFE [${launchId}]: Attempting to close previous browser instance...`
            )
            await this.browser.close()
          } catch (e: any) {
            logger.warn(
              `[${callId}] Launch IIFE [${launchId}]: Error closing previous browser instance: ${e.message}`
            )
          }
        }
        this.browser = undefined // Ensure it's clear before launch
        this.browserClosed = true // Assume closed until successfully launched

        logger.info(
          `[${callId}] Launch IIFE [${launchId}]: Launching new chromium instance...`
        )
        const newBrowser = await chromium.launch({
          headless: false, // Keeping this false as per your last change for debugging
          args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        })

        logger.info(
          `[${callId}] Launch IIFE [${launchId}]: New browser launched successfully.`
        )
        this.browser = newBrowser // Assign the new browser
        this.browserClosed = false // Mark as not closed

        newBrowser.on('disconnected', () => {
          logger.info(
            `[${callId}] Launch IIFE [${launchId}]: Browser disconnected event received.`
          )
          this.browserClosed = true
          if (this.browser === newBrowser) {
            // Avoid race conditions if a newer browser exists
            this.browser = undefined
          }
          // If a launch was in progress when disconnect happened, maybe clear promise?
          // Careful consideration needed here, depends on desired retry behavior.
          // For now, rely on the initial check in getBrowser to handle this.
        })

        return newBrowser // Return the successfully launched browser
      } catch (launchError: any) {
        logger.error(
          `[${callId}] Launch IIFE [${launchId}]: CRITICAL - Failed to launch browser: ${launchError.message}`,
          {stack: launchError.stack}
        )
        this.browser = undefined // Ensure browser is undefined on failure
        this.browserClosed = true
        throw launchError // Re-throw the error so callers know it failed
      } finally {
        // Once this launch attempt (successful or failed) is done, clear the promise
        // so the *next* call to getBrowser (if needed) can start a fresh attempt.
        logger.info(
          `[${callId}] Launch IIFE [${launchId}] FINALLY: Clearing browser launch promise.`
        )
        this.browserLaunchPromise = null
      }
    })()

    logger.info(
      `[${callId}] getBrowser: Returning the newly created launch promise.`
    )
    return this.browserLaunchPromise
  }

  /**
   * Requires a page from the pool, reusing a released page if possible,
   * or creating a new one if necessary and space allows.
   * Waits if the pool is full.
   * @returns A promise that resolves to a page instance.
   */
  public async requirePage(): Promise<Page> {
    this.lastActivityTime = Date.now() // Update activity time
    logger.info(
      `requirePage: Pool state: Required=${
        this.requiredPages.length
      }, Released=${
        this.releasedPages.length
      }, Total=${this.getCurrentSize()}, Max=${this.maxSize}`
    )

    // Try to reuse a released page first
    while (this.releasedPages.length > 0) {
      const page = this.releasedPages.pop()!
      if (!page.isClosed() && page.context().browser()?.isConnected()) {
        logger.info('requirePage: Reusing released page.')
        this.requiredPages.push(page)
        return page
      } else {
        logger.warn(
          'requirePage: Found a closed/disconnected page in releasedPages, discarding.'
        )
        // Ensure waiting queue is notified if discarding reduces potential size implicitly
        this._notifyWaitQueue()
      }
    }

    // No released page available, check size before creating a new one
    logger.info(
      `requirePage: Pool is full (${this.getCurrentSize()}/${
        this.maxSize
      }). Waiting for a page to be released...`
    )
    while (this.getCurrentSize() >= this.maxSize) {
      logger.info(
        `requirePage: Pool is full (${this.getCurrentSize()}/${
          this.maxSize
        }). Waiting for a page to be released...`
      )
      await new Promise<void>((resolve) => this.waitQueue.push(resolve))
      logger.info(
        'requirePage: Woke up from wait queue. Re-checking availability...'
      )
      // Re-check if a released page became available while waiting
      if (this.releasedPages.length > 0) {
        logger.info(
          'requirePage: Found released page after waiting. Attempting reuse.'
        )
        // Loop back to the start of the method to attempt reuse
        continue // Use continue to jump back to the 'while (this.releasedPages.length >0)' check
      }
      logger.info(
        `requirePage: Still no released pages. Pool size: ${this.getCurrentSize()}. Max: ${
          this.maxSize
        }.`
      )
      // If still full after waking up, loop again to wait.
    }

    // If we reach here, we have capacity
    logger.info('requirePage: Pool has capacity. Getting browser...')
    let browser = await this.getBrowser()

    // Double-check browser connection right before creating the page
    if (!browser.isConnected()) {
      logger.warn(
        'requirePage: Browser disconnected unexpectedly between getBrowser and newPage. Retrying getBrowser...'
      )
      this.browserClosed = true
      this.browser = undefined
      browser = await this.getBrowser()

      if (!browser.isConnected()) {
        logger.error(
          'requirePage: Failed to get a connected browser instance after retry.'
        )
        throw new Error(
          'Failed to get a connected browser instance after retry.'
        )
      }
      logger.info(
        'requirePage: Successfully obtained a new connected browser instance on retry.'
      )
    }

    logger.info('requirePage: Attempting browser.newPage()...')
    try {
      const page = await browser.newPage({
        /* userAgent, bypassCSP etc. if needed */
        viewport: { width: 1280, height: 720 }, // Example default viewport
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        bypassCSP: true,
      })
      logger.info('requirePage: New page created successfully.')
      this.requiredPages.push(page) // Add to required
      return page
    } catch (error: any) {
      logger.error('requirePage: Error during browser.newPage():', {
        errorMessage: error.message,
        stack: error.stack,
      })
      if (
        error.message.includes(
          'Target page, context or browser has been closed'
        )
      ) {
        logger.error(
          'requirePage: Browser reported closed during newPage(). Marking as closed.'
        )
        this.browserClosed = true
        this.browser = undefined
        // Don't notify queue here, as we failed to add a page
      }
      // If page creation failed, make sure we potentially unblock waiting requests
      this._notifyWaitQueue()
      throw error
    }
  }

  /**
   * Releases a page back to the pool.
   * @param page The page to release.
   */
  public async releasePage(page: Page): Promise<void> {
    this.lastActivityTime = Date.now()
    logger.info('releasePage: Starting release process.')

    const requiredIndex = this.requiredPages.indexOf(page)
    if (requiredIndex === -1) {
      this._handleUnknownReleaseAttempt(page)
      return // Exit early if page is not recognized as active
    }

    // Remove page from active list *before* attempting cleanup
    this.requiredPages.splice(requiredIndex, 1)
    logger.info(`releasePage: Removed page from requiredPages list.`)

    try {
      // Attempt to cleanup the page (navigate to blank) and pool it, or close it.
      await this._cleanupOrClosePage(page)
    } catch (error: any) {
      // Catch unexpected errors from _cleanupOrClosePage itself
      logger.error(
        `releasePage: Unexpected error during page cleanup/close: ${error.message}`
      )
      // Ensure page is attempted to be closed even if _cleanupOrClosePage fails unexpectedly
      await this._closePageSafely(page, 'releasePage main catch')
    } finally {
      // Always notify the queue after a page is removed from requiredPages,
      // regardless of whether it was successfully pooled or closed,
      // as a slot has become available.
      logger.info('releasePage: Notifying wait queue.')
      this._notifyWaitQueue()
    }
    logger.info('releasePage: Finished release process.')
  }

  /**
   * Handles the logic when an attempt is made to release a page
   * that is not currently tracked as required/active.
   */
  private _handleUnknownReleaseAttempt(page: Page): void {
    logger.warn(
      'releasePage: Attempted to release an unknown or already released page.'
    )
    if (this.releasedPages.includes(page)) {
      logger.warn(
        'releasePage: Page was found in releasedPages (potential double release).'
      )
    }
    // No need to notify queue here, as this page wasn't occupying a counted slot.
    // If it was a double release, the original release would have notified.
    // The original code had a potential notification here if getCurrentSize >= maxSize,
    // but that seems incorrect as releasing an unknown page shouldn't free a slot.
  }

  /**
   * Attempts to clean up a page by navigating it to 'about:blank' and adding it
   * to the released pool. If cleanup fails or isn't possible (e.g., page closed),
   * it ensures the page is closed.
   */
  private async _cleanupOrClosePage(page: Page): Promise<void> {
    if (!page.isClosed() && page.context().browser()?.isConnected()) {
      logger.info(
        'releasePage: Page is open and browser connected. Attempting cleanup.'
      )
      try {
        // Navigate to about:blank if not already there
        if (page.url() !== 'about:blank') {
          logger.info('releasePage: Navigating page to about:blank...')
          await page.goto('about:blank', {
            waitUntil: 'domcontentloaded',
            timeout: 3000, // Keep timeout relatively short
          })
          logger.info('releasePage: Navigated page to about:blank.')
        } else {
          logger.info(
            'releasePage: Page already at about:blank, skipping navigation.'
          )
        }
        // Add to pool only if cleanup succeeded
        this.releasedPages.push(page)
        logger.info('releasePage: Added page back to released pool.')
      } catch (error: any) {
        logger.warn(
          `releasePage: Error during cleanup (goto about:blank): ${error.message}. Closing page instead.`
        )
        await this._closePageSafely(page, 'goto about:blank error')
      }
    } else {
      // Page is already closed or browser disconnected
      logger.warn(
        'releasePage: Page was already closed or browser disconnected. Ensuring it is fully closed.'
      )
      await this._closePageSafely(page, 'page closed or browser disconnected')
    }
  }

  /**
   * Safely attempts to close a Playwright page, logging any errors.
   */
  private async _closePageSafely(page: Page, context: string): Promise<void> {
    try {
      if (!page.isClosed()) {
        logger.info(`releasePage [${context}]: Attempting to close page.`)
        await page.close({ runBeforeUnload: true }) // Attempt graceful close
        logger.info(`releasePage [${context}]: Closed page successfully.`)
      } else {
        logger.info(`releasePage [${context}]: Page was already closed.`)
      }
    } catch (closeError: any) {
      logger.warn(
        `releasePage [${context}]: Error closing page: ${closeError.message}`
      )
      // Log the error, but don't rethrow. The goal is to release the slot.
    }
  }

  // Helper to notify the wait queue
  private _notifyWaitQueue(): void {
    if (this.waitQueue.length > 0) {
      logger.info(
        `_notifyWaitQueue: Notifying ${
          this.waitQueue.length
        } waiting request(s). Current pool size ${this.getCurrentSize()}/${
          this.maxSize
        }`
      )
      const resolve = this.waitQueue.shift() // Get the first waiting resolver
      if (resolve) {
        resolve() // Unblock the promise
        logger.info('_notifyWaitQueue: Signaled one waiting request.')
      }
    }
  }

  /**
   * Closes the browser instance and cleans up resources.
   */
  public async close(): Promise<void> {
    logger.info('BrowserPool: Closing browser and cleaning up...')
    // Clear wait queue to prevent pending operations
    this.waitQueue.forEach((resolve) => resolve()) // Resolve all waiting promises immediately
    this.waitQueue = []

    // Close all pages
    const closePagePromises = [
      ...this.requiredPages,
      ...this.releasedPages,
    ].map(async (page) => {
      if (!page.isClosed()) {
        try {
          await page.close({runBeforeUnload: true})
        } catch (e: any) {
          logger.warn(
            `close: Error closing page during pool cleanup: ${e.message}`
          )
        }
      }
    })
    await Promise.all(closePagePromises)
    this.requiredPages = []
    this.releasedPages = []

    if (this.browser && !this.browserClosed) {
      try {
        await this.browser.close()
        logger.info('BrowserPool: Browser instance closed.')
      } catch (e: any) {
        logger.error(
          `BrowserPool: Error closing browser instance: ${e.message}`
        )
      }
    }
    this.browser = undefined
    this.browserClosed = true

    // Clear idle check timer first
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer)
      this.idleCheckTimer = null
      logger.info('BrowserPool: Idle check timer stopped.')
    }
  }

  // --- Idle Timeout Logic ---
  private async _checkIdleTimeout(): Promise<void> {
    if (!this.browser || this.browserClosed || !this.browser.isConnected()) {
      // No browser or already closed/disconnected, nothing to do
      return
    }

    if (this.requiredPages.length > 0) {
      // Pages are actively in use, reset activity time and return
      this.lastActivityTime = Date.now()
      return
    }

    const idleDuration = Date.now() - this.lastActivityTime
    logger.info(
      `_checkIdleTimeout: Current idle duration: ${idleDuration}ms / ${this.idleTimeoutMs}ms`
    )

    if (idleDuration > this.idleTimeoutMs) {
      logger.info(
        `BrowserPool: Idle timeout exceeded (${idleDuration}ms > ${this.idleTimeoutMs}ms). Closing idle browser.`
      )
      await this.close() // Close the pool (which closes the browser)
    }
  }
  // --- End Idle Timeout Logic ---
}

export {BrowserPool}
