import nodemailer from 'nodemailer'
import { logger } from './logger.js'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null
  private from: string

  constructor() {
    this.from = process.env.EMAIL_FROM || 'Browser Pool <noreply@browserpool.com>'
    this.initializeTransporter()
  }

  private initializeTransporter() {
    const emailEnabled = process.env.EMAIL_ENABLED === 'true'

    if (!emailEnabled) {
      logger.info('Email service disabled')
      return
    }

    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || '587')
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
      logger.warn('SMTP credentials not configured, email service disabled')
      return
    }

    try {
      this.transporter = nodemailer.createTransporter({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      })

      logger.info('Email service initialized', { host, port, user })
    } catch (error) {
      logger.error('Failed to initialize email service:', error)
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.transporter) {
      logger.debug('Email not sent (service disabled):', options.subject)
      return false
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: options.to,
        subject: options.subject,
        text: options.text || this.stripHtml(options.html),
        html: options.html,
      })

      logger.info('Email sent successfully', {
        to: options.to,
        subject: options.subject,
        messageId: info.messageId,
      })

      return true
    } catch (error: any) {
      logger.error('Failed to send email:', {
        error: error.message,
        to: options.to,
        subject: options.subject,
      })
      return false
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
  }

  // Email templates
  async sendWelcomeEmail(email: string, name: string, apiKey: string) {
    const subject = 'Welcome to Browser Pool!'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .code { background: #1f2937; color: #10b981; padding: 10px; border-radius: 5px; font-family: monospace; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Browser Pool! 🎉</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thanks for signing up for Browser Pool! You're all set to start taking screenshots with our API.</p>

            <h3>Your API Key:</h3>
            <div class="code">${apiKey}</div>
            <p><strong>⚠️ Important:</strong> Store this API key securely. You won't be able to see it again!</p>

            <h3>Getting Started:</h3>
            <pre class="code">curl -X POST https://api.browserpool.com/screenshot \\
  -H "X-API-Key: ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://example.com"}' \\
  -o screenshot.png</pre>

            <h3>Your Plan:</h3>
            <ul>
              <li>✅ 100 screenshots per month</li>
              <li>✅ 5 requests per minute</li>
              <li>✅ Cookie consent handling</li>
            </ul>

            <p>Want more? Upgrade to Pro or Enterprise for higher limits!</p>
            <a href="https://app.browserpool.com/pricing" class="button">View Pricing</a>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
            <p><a href="https://docs.browserpool.com">Documentation</a> | <a href="https://app.browserpool.com/support">Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendPasswordResetEmail(email: string, name: string, resetToken: string) {
    const resetUrl = `${process.env.ORIGIN_URL}/reset-password?token=${resetToken}`
    const subject = 'Reset Your Password'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Reset Your Password</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <p><a href="${resetUrl}" class="button">Reset Password</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendEmailVerification(email: string, name: string, verificationToken: string) {
    const verifyUrl = `${process.env.ORIGIN_URL}/verify-email?token=${verificationToken}`
    const subject = 'Verify Your Email Address'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Verify Your Email</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Please verify your email address by clicking the button below:</p>
            <p><a href="${verifyUrl}" class="button">Verify Email</a></p>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all;">${verifyUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendQuotaWarning(email: string, name: string, used: number, limit: number, percentage: number) {
    const subject = `Quota Warning: ${percentage.toFixed(0)}% Used`
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #F59E0B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .stats { background: white; padding: 15px; border-left: 4px solid #F59E0B; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Quota Warning</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>You've used ${percentage.toFixed(0)}% of your monthly screenshot quota.</p>
            <div class="stats">
              <strong>Current Usage:</strong><br>
              ${used} / ${limit} screenshots (${limit - used} remaining)
            </div>
            <p>Consider upgrading your plan to avoid service interruption:</p>
            <a href="https://app.browserpool.com/pricing" class="button">Upgrade Plan</a>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendQuotaExceeded(email: string, name: string, limit: number) {
    const subject = 'Monthly Quota Exceeded'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🚫 Quota Exceeded</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>You've reached your monthly limit of ${limit} screenshots. Your API requests will be blocked until you upgrade or your quota resets next month.</p>
            <p><strong>What can you do?</strong></p>
            <ul>
              <li>Upgrade to a higher plan for more screenshots</li>
              <li>Wait until your quota resets on the 1st of next month</li>
            </ul>
            <a href="https://app.browserpool.com/pricing" class="button">Upgrade Now</a>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendPaymentSuccess(email: string, name: string, amount: number, plan: string) {
    const subject = 'Payment Received - Thank You!'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #10B981; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .receipt { background: white; padding: 15px; border: 1px solid #ddd; margin: 15px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Payment Successful</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Thank you for your payment! Your subscription has been activated.</p>
            <div class="receipt">
              <strong>Receipt:</strong><br>
              Plan: ${plan}<br>
              Amount: $${(amount / 100).toFixed(2)} USD<br>
              Date: ${new Date().toLocaleDateString()}
            </div>
            <p>Your enhanced features are now active! 🎉</p>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
            <p><a href="https://app.browserpool.com/billing">View Billing History</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendPaymentFailed(email: string, name: string, reason: string) {
    const subject = 'Payment Failed - Action Required'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #EF4444; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ Payment Failed</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>We were unable to process your payment. Here's what happened:</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>Please update your payment method to continue using Browser Pool without interruption.</p>
            <a href="https://app.browserpool.com/billing" class="button">Update Payment Method</a>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
            <p>Need help? <a href="https://app.browserpool.com/support">Contact Support</a></p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }

  async sendSubscriptionCanceled(email: string, name: string, endDate: Date) {
    const subject = 'Subscription Canceled'
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #6B7280; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9fafb; }
          .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Subscription Canceled</h1>
          </div>
          <div class="content">
            <p>Hi ${name},</p>
            <p>Your subscription has been canceled. You'll continue to have access to your paid features until ${endDate.toLocaleDateString()}.</p>
            <p>After that, you'll be moved to the Free plan.</p>
            <p>Changed your mind?</p>
            <a href="https://app.browserpool.com/billing" class="button">Reactivate Subscription</a>
            <p>We're sorry to see you go. If you have feedback, we'd love to hear it!</p>
          </div>
          <div class="footer">
            <p>Browser Pool - Screenshot as a Service</p>
          </div>
        </div>
      </body>
      </html>
    `

    return this.sendEmail({ to: email, subject, html })
  }
}

export const emailService = new EmailService()
