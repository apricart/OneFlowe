/**
 * Email Service
 * Handles email sending using nodemailer with SMTP configuration
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import { logError } from '@/lib/global-logger'

// Email configuration from environment variables
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER,
  pass: process.env.SMTP_PASS?.replace(/\s+/g, ''),
  from: process.env.SMTP_USER || 'noreply@example.com',
} as const

// Validate email configuration
function validateEmailConfig(): boolean {
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.error('[Email] SMTP credentials not configured. Please set SMTP_USER and SMTP_PASS in .env.local')
    return false
  }
  return true
}

// Create transporter instance (singleton)
let transporter: Transporter | null = null

function getTransporter(): Transporter | null {
  if (!validateEmailConfig()) {
    return null
  }

  if (!transporter) {
    try {
      transporter = nodemailer.createTransport({
        host: EMAIL_CONFIG.host,
        port: EMAIL_CONFIG.port,
        secure: EMAIL_CONFIG.port === 465, // true for 465, false for other ports
        auth: {
          user: EMAIL_CONFIG.user,
          pass: EMAIL_CONFIG.pass,
        },
      })
    } catch (error) {
      logError(error, 'EMAIL_CREATE_TRANSPORTER')
      return null
    }
  }

  return transporter
}

/**
 * Generate HTML email template for OTP
 */
function generateOTPEmailHTML(code: string, type: string): string {
  const typeText = type === 'LOGIN' ? 'Login' : type === 'VERIFY_EMAIL' ? 'Email Verification' : 'Password Reset'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your OTP Code</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">OneFlowe</h1>
                  <p style="margin: 10px 0 0 0; color: #ffffff; font-size: 14px; opacity: 0.9;">${typeText} Verification</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <p style="margin: 0 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    Hello,
                  </p>
                  <p style="margin: 0 0 30px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    We received a request for ${typeText.toLowerCase()}. Please use the following one-time password (OTP) to complete your verification:
                  </p>
                  
                  <!-- OTP Code -->
                  <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                    <tr>
                      <td style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                        <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #667eea; font-family: 'Courier New', monospace;">
                          ${code}
                        </div>
                      </td>
                    </tr>
                  </table>
                  
                  <p style="margin: 30px 0 20px 0; color: #333333; font-size: 16px; line-height: 1.5;">
                    This code will expire in <strong>2 minutes</strong>.
                  </p>
                  
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px; line-height: 1.5;">
                    If you didn't request this code, please ignore this email or contact support if you have concerns.
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                  <p style="margin: 0 0 10px 0; color: #666666; font-size: 14px;">
                    This is an automated message, please do not reply.
                  </p>
                  <p style="margin: 0; color: #999999; font-size: 12px;">
                    © ${new Date().getFullYear()} OneFlowe. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Generate plain text email for OTP (fallback)
 */
function generateOTPEmailText(code: string, type: string): string {
  const typeText = type === 'LOGIN' ? 'Login' : type === 'VERIFY_EMAIL' ? 'Email Verification' : 'Password Reset'

  return `
OneFlowe - ${typeText} Verification

Hello,

We received a request for ${typeText.toLowerCase()}. Please use the following one-time password (OTP) to complete your verification:

OTP Code: ${code}

This code will expire in 2 minutes.

If you didn't request this code, please ignore this email or contact support if you have concerns.

This is an automated message, please do not reply.

© ${new Date().getFullYear()} OneFlowe. All rights reserved.
  `.trim()
}

/**
 * Send OTP email to user
 */
export async function sendOTPEmail(
  to: string,
  code: string,
  type: 'LOGIN' | 'VERIFY_EMAIL' | 'RESET_PASSWORD'
): Promise<boolean> {
  try {
    // Validate inputs
    if (!to || !code || !type) {
      console.error('[Email] Invalid parameters for sendOTPEmail')
      return false
    }

    // Get transporter
    const transport = getTransporter()
    if (!transport) {
      console.error('[Email] Failed to create email transporter. Check SMTP configuration.')
      return false
    }

    // Prepare email subject
    const typeText = type === 'LOGIN' ? 'Login' : type === 'VERIFY_EMAIL' ? 'Email Verification' : 'Password Reset'
    const subject = `Your OneFlowe ${typeText} Code`

    // Send email
    const info = await transport.sendMail({
      from: `"OneFlowe" <${EMAIL_CONFIG.from}>`,
      to,
      subject,
      text: generateOTPEmailText(code, type),
      html: generateOTPEmailHTML(code, type),
    })


    return true

  } catch (error) {
    logError(error, 'EMAIL_SEND_OTP', { to, type })
    return false
  }
}

/**
 * Verify email service configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    const transport = getTransporter()
    if (!transport) {
      return false
    }

    await transport.verify()
    console.log('[Email] SMTP configuration verified successfully')
    return true
  } catch (error) {
    logError(error, 'EMAIL_VERIFY_CONFIG')
    return false
  }
}

/**
 * Generate HTML email template for Reports
 */
function generateReportEmailHTML(reportName: string, frequency: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${reportName} Delivery</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 40px 0;">
            <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
              <!-- Header -->
              <tr>
                <td style="background-color: #4f46e5; padding: 40px 30px; text-align: center;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; text-transform: uppercase; font-style: italic;">OneFlowe BI</h1>
                  <p style="margin: 10px 0 0 0; color: #e0e7ff; font-size: 14px; font-weight: 500; opacity: 0.9;">Automated Intel Delivery</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px 30px;">
                  <div style="display: flex; align-items: center; margin-bottom: 24px;">
                    <span style="background-color: #f0f9ff; color: #0369a1; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">${frequency} REPORT</span>
                  </div>
                  <h2 style="margin: 0 0 16px 0; color: #1e293b; font-size: 20px; font-weight: 700;">${reportName}</h2>
                  <p style="margin: 0 0 24px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                    Hello, please find your scheduled ${reportName.toLowerCase()} attached below. This report contains the latest data audits and performance metrics based on your configuration.
                  </p>
                  
                  <div style="padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #f1f5f9; margin-bottom: 24px;">
                    <p style="margin: 0 0 8px 0; color: #64748b; font-size: 12px; font-weight: 600; text-transform: uppercase;">Delivery Details</p>
                    <p style="margin: 0; color: #1e293b; font-size: 14px; font-weight: 500;">
                      <strong>Generated At:</strong> ${new Date().toLocaleString()}<br>
                      <strong>Frequency:</strong> ${frequency}<br>
                      <strong>Format:</strong> CSV Attachment
                    </p>
                  </div>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #f1f5f9;">
                  <p style="margin: 0 0 10px 0; color: #94a3b8; font-size: 13px;">
                    To modify this schedule, please login to your OneFlowe Portal.
                  </p>
                  <p style="margin: 0; color: #cbd5e1; font-size: 12px;">
                    © ${new Date().getFullYear()} OneFlowe BI Solutions. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

/**
 * Send Automated Report email
 */
export async function sendReportEmail(
  to: string | string[],
  reportName: string,
  frequency: string,
  attachmentData: Buffer | string,
  fileName: string
): Promise<boolean> {
  try {
    const transport = getTransporter()
    if (!transport) return false

    const recipients = Array.isArray(to) ? to.join(', ') : to
    const subject = `[REPORT] ${reportName} - ${new Date().toLocaleDateString()}`

    await transport.sendMail({
      from: `"OneFlowe BI" <${EMAIL_CONFIG.from}>`,
      to: recipients,
      subject,
      html: generateReportEmailHTML(reportName, frequency),
      attachments: [
        {
          filename: fileName,
          content: attachmentData,
        },
      ],
    })

    return true
  } catch (error) {
    console.error(`[Email] Failed to send report email:`, error)
    logError(error, 'EMAIL_SEND_REPORT', { to, reportName })
    return false
  }
}

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const escapeXml = escapeHtml

export type OrderTokenEmailItem = {
  productName: string
  productCode?: string | null
  quantity: number
  unit?: string | null
}

export type OrderTokenEmailDetails = {
  to: string
  token: string
  tid: string
  organizationName: string
  branchName: string
  status: string
  createdAt: Date | string | null
  items: OrderTokenEmailItem[]
}

const RESEND_EMAIL_CONFIG = {
  apiKey: process.env.RESEND_API_KEY,
  from: process.env.RESEND_ORDER_TOKEN_FROM || process.env.RESEND_FROM || "OneFlowe Orders <onboarding@resend.dev>",
} as const

const generateOrderTokenEmailSVG = (details: OrderTokenEmailDetails) => {
  const createdAt = details.createdAt ? new Date(details.createdAt).toLocaleString() : "N/A"
  const visibleItems = details.items.slice(0, 6)
  const extraItemsCount = Math.max(0, details.items.length - visibleItems.length)
  const itemRows = visibleItems.map((item, index) => {
    const y = 425 + index * 42
    const productLabel = `${item.productCode ? `${item.productCode} - ` : ""}${item.productName}`
    const quantityLabel = `${item.quantity}${item.unit ? ` ${item.unit}` : ""}`
    return `
      <text x="64" y="${y}" fill="#1e293b" font-size="20" font-weight="700">${escapeXml(productLabel).slice(0, 62)}</text>
      <text x="920" y="${y}" fill="#4f46e5" font-size="20" font-weight="800" text-anchor="end">${escapeXml(quantityLabel)}</text>
    `
  }).join("")

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1000" height="760" viewBox="0 0 1000 760">
      <rect width="1000" height="760" rx="36" fill="#f8fafc"/>
      <rect x="36" y="36" width="928" height="692" rx="30" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
      <rect x="36" y="36" width="928" height="132" rx="30" fill="#4f46e5"/>
      <text x="64" y="92" fill="#ffffff" font-family="Arial, sans-serif" font-size="34" font-weight="900">OneFlowe Fulfillment Token</text>
      <text x="64" y="130" fill="#c7d2fe" font-family="Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="4">SHARE WITH SUPER ADMIN</text>

      <text x="64" y="218" fill="#64748b" font-family="Arial, sans-serif" font-size="16" font-weight="800" letter-spacing="3">TOKEN</text>
      <rect x="64" y="236" width="872" height="92" rx="18" fill="#eef2ff" stroke="#c7d2fe" stroke-width="2"/>
      <text x="500" y="295" fill="#4338ca" font-family="Courier New, monospace" font-size="46" font-weight="900" text-anchor="middle" letter-spacing="8">${escapeXml(details.token)}</text>

      <text x="64" y="376" fill="#64748b" font-family="Arial, sans-serif" font-size="16" font-weight="800" letter-spacing="3">ORDER DETAILS</text>
      <text x="64" y="404" fill="#1e293b" font-family="Arial, sans-serif" font-size="19" font-weight="700">TID: ${escapeXml(details.tid)}</text>
      <text x="360" y="404" fill="#1e293b" font-family="Arial, sans-serif" font-size="19" font-weight="700">Status: ${escapeXml(details.status)}</text>
      <text x="64" y="654" fill="#475569" font-family="Arial, sans-serif" font-size="18" font-weight="700">Organization: ${escapeXml(details.organizationName)}</text>
      <text x="64" y="686" fill="#475569" font-family="Arial, sans-serif" font-size="18" font-weight="700">Branch: ${escapeXml(details.branchName)}</text>
      <text x="64" y="716" fill="#94a3b8" font-family="Arial, sans-serif" font-size="15" font-weight="600">Created: ${escapeXml(createdAt)}</text>
      ${itemRows}
      ${extraItemsCount > 0 ? `<text x="64" y="${425 + visibleItems.length * 42}" fill="#64748b" font-family="Arial, sans-serif" font-size="18" font-weight="700">+${extraItemsCount} more item${extraItemsCount === 1 ? "" : "s"}</text>` : ""}
    </svg>
  `.trim()
}

const generateOrderTokenEmailHTML = (details: OrderTokenEmailDetails) => {
  const createdAt = details.createdAt ? new Date(details.createdAt).toLocaleString() : "N/A"
  const items = details.items.map((item) => `
    <tr>
      <td style="padding: 8px 0; color: #334155; font-size: 14px; font-weight: 600;">${escapeHtml(item.productCode ? `${item.productCode} - ${item.productName}` : item.productName)}</td>
      <td style="padding: 8px 0; color: #4f46e5; font-size: 14px; font-weight: 800; text-align: right;">${escapeHtml(`${item.quantity}${item.unit ? ` ${item.unit}` : ""}`)}</td>
    </tr>
  `).join("")

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Fulfillment Token</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f8fafc;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 32px 0;">
            <table role="presentation" style="width: 100%; max-width: 640px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
              <tr>
                <td style="background-color: #4f46e5; padding: 30px;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 900;">OneFlowe Fulfillment Token</h1>
                  <p style="margin: 8px 0 0; color: #c7d2fe; font-size: 12px; font-weight: 700; letter-spacing: 2px;">SHARE WITH SUPER ADMIN</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 30px;">
                  <p style="margin: 0 0 10px; color: #64748b; font-size: 12px; font-weight: 800; letter-spacing: 2px;">TOKEN</p>
                  <div style="padding: 18px; background-color: #eef2ff; border: 1px solid #c7d2fe; border-radius: 12px; color: #4338ca; font-family: 'Courier New', monospace; font-size: 30px; font-weight: 900; letter-spacing: 6px; text-align: center;">
                    ${escapeHtml(details.token)}
                  </div>
                  <table role="presentation" style="width: 100%; margin-top: 26px; border-collapse: collapse;">
                    <tr><td style="color: #64748b; font-size: 13px; font-weight: 700;">TID</td><td style="text-align: right; color: #1e293b; font-size: 13px; font-weight: 800;">${escapeHtml(details.tid)}</td></tr>
                    <tr><td style="padding-top: 8px; color: #64748b; font-size: 13px; font-weight: 700;">Organization</td><td style="padding-top: 8px; text-align: right; color: #1e293b; font-size: 13px; font-weight: 800;">${escapeHtml(details.organizationName)}</td></tr>
                    <tr><td style="padding-top: 8px; color: #64748b; font-size: 13px; font-weight: 700;">Branch</td><td style="padding-top: 8px; text-align: right; color: #1e293b; font-size: 13px; font-weight: 800;">${escapeHtml(details.branchName)}</td></tr>
                    <tr><td style="padding-top: 8px; color: #64748b; font-size: 13px; font-weight: 700;">Created</td><td style="padding-top: 8px; text-align: right; color: #1e293b; font-size: 13px; font-weight: 800;">${escapeHtml(createdAt)}</td></tr>
                  </table>
                  <table role="presentation" style="width: 100%; margin-top: 24px; border-collapse: collapse; border-top: 1px solid #e2e8f0;">
                    ${items}
                  </table>
                  <p style="margin: 24px 0 0; color: #64748b; font-size: 13px; line-height: 1.5;">The token card is attached as an image file.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

export async function sendOrderTokenEmail(details: OrderTokenEmailDetails): Promise<boolean> {
  try {
    if (!RESEND_EMAIL_CONFIG.apiKey) {
      console.error("[Email] RESEND_API_KEY is not configured for order token email")
      return false
    }

    const svg = generateOrderTokenEmailSVG(details)
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_EMAIL_CONFIG.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: RESEND_EMAIL_CONFIG.from,
        to: details.to,
        subject: `Fulfillment token for order ${details.tid}`,
        html: generateOrderTokenEmailHTML(details),
        text: [
          `OneFlowe fulfillment token`,
          `Token: ${details.token}`,
          `TID: ${details.tid}`,
          `Organization: ${details.organizationName}`,
          `Branch: ${details.branchName}`,
        ].join("\n"),
        attachments: [
          {
            filename: `oneflowe-token-${details.tid}.svg`,
            content: Buffer.from(svg, "utf8").toString("base64"),
          },
        ],
        tags: [
          { name: "type", value: "order_token" },
          { name: "tid", value: details.tid.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 256) },
        ],
      }),
    })

    if (!response.ok) {
      const responseText = await response.text()
      console.error("[Email] Resend order token email failed:", response.status, responseText)
      return false
    }

    return true
  } catch (error) {
    console.error("[Email] Failed to send order token email with Resend:", error)
    logError(error, "RESEND_SEND_ORDER_TOKEN", { to: details.to, tid: details.tid })
    return false
  }
}
