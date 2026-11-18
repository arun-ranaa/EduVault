const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Send email verification link to the user.
 * @param {string} toEmail - Recipient email address
 * @param {string} name    - Recipient's display name
 * @param {string} token   - Unique verification token
 */
const sendVerificationEmail = async (toEmail, name, token) => {
  const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/+$/, '');
  const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const safeName = escapeHtml(name);

  const mailOptions = {
    from: `"EduVault" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: 'Verify your EduVault email address',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </head>
        <body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:36px 40px;text-align:center;">
                      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.5px;">EduVault</h1>
                      <p style="margin:6px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">Your Academic Resource Hub</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="margin:0 0 16px;color:#1e1b4b;font-size:22px;">Hi ${safeName}, verify your email</h2>
                      <p style="margin:0 0 24px;color:#4b5563;font-size:15px;line-height:1.6;">
                        Thanks for signing up! Click the button below to verify your email address and activate your account.
                        This link expires in <strong>24 hours</strong>.
                      </p>
                      <table cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td align="center" style="padding:8px 0 32px;">
                            <a href="${verifyUrl}"
                               style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                              Verify Email Address
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin:0 0 8px;color:#6b7280;font-size:13px;">Or paste this link in your browser:</p>
                      <p style="margin:0 0 32px;color:#4f46e5;font-size:12px;word-break:break-all;">${verifyUrl}</p>
                      <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 24px;" />
                      <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.5;">
                        If you didn't create an EduVault account, you can safely ignore this email.<br/>
                        This link will expire in 24 hours.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
                      <p style="margin:0;color:#9ca3af;font-size:12px;">© 2024 EduVault. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendVerificationEmail };
