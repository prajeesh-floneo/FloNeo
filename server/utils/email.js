const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = this.createTransporter();
    this.verifyConnection();
  }

  async verifyConnection() {
    if (!this.transporter || process.env.EMAIL_VERIFICATION_DISABLED === 'true') {
      console.log('📧 SMTP disabled for development, using console fallback');
      return;
    }

    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (error) {
      console.log('⚠️ SMTP connection failed, falling back to console logging:', error.message);
    }
  }

  createTransporter() {
    // If email verification is disabled for development, return null
    if (process.env.EMAIL_VERIFICATION_DISABLED === 'true') {
      console.log('📧 Email verification disabled for development');
      return null;
    }

    // Use environment variables for SMTP configuration
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    // If SMTP not configured, use console logging
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_PASS === 'development-mode-disabled') {
      console.log('📧 SMTP not configured, emails will be logged to console');
      return null;
    }

    return nodemailer.createTransport(config);
  }

  async sendOTP(email, otp, type = 'signup') {
    const subject = this.getOTPSubject(type);
    const html = this.getOTPTemplate(otp, type);

    if (!this.transporter) {
      // Log to console if SMTP not configured
      console.log(`📧 Email would be sent to: ${email}`);
      console.log(`📧 Subject: ${subject}`);
      console.log(`📧 OTP: ${otp}`);
      console.log(`📧 Type: ${type}`);
      return { success: true, message: 'Email logged to console' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject,
        html,
      });

      console.log(`📧 Email sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('📧 Email sending failed:', error);
      // Fallback to console logging
      console.log(`📧 Fallback - Email to: ${email}, OTP: ${otp}, Type: ${type}`);
      return { success: false, error: error.message };
    }
  }

  async sendProjectInvite(email, projectName, inviteToken, inviterName) {
    const subject = `You're invited to join "${projectName}" on FloNeo`;
    const html = this.getInviteTemplate(projectName, inviteToken, inviterName);

    if (!this.transporter) {
      console.log(`📧 Project invite would be sent to: ${email}`);
      console.log(`📧 Project: ${projectName}`);
      console.log(`📧 Invite Token: ${inviteToken}`);
      console.log(`📧 Inviter: ${inviterName}`);
      return { success: true, message: 'Invite logged to console' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject,
        html,
      });

      console.log(`📧 Project invite sent successfully: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Project invite sending failed:', error.message);
      console.log(`📧 Fallback - Invite to: ${email}, Project: ${projectName}, Token: ${inviteToken}`);
      return { success: false, error: error.message };
    }
  }

  async sendNotificationEmail(email, type, message, userName = 'User') {
    const subject = this.getNotificationSubject(type);
    const html = this.getNotificationTemplate(type, message, userName);

    if (!this.transporter) {
      console.log(`📧 Notification email would be sent to: ${email}`);
      console.log(`📧 Type: ${type}, Message: ${message}`);
      return { success: true, message: 'Notification logged to console' };
    }

    try {
      const info = await this.transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: email,
        subject,
        html,
      });

      console.log(`✅ Email sent successfully to ${email}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error(`❌ Email failed to ${email}:`, error.message);
      console.log(`📧 Fallback - Notification to: ${email}, Type: ${type}, Message: ${message}`);
      return { success: false, error: error.message };
    }
  }

  getOTPSubject(type) {
    switch (type) {
      case 'signup':
        return 'Welcome to FloNeo - Verify Your Email';
      case 'forgot-password':
        return 'FloNeo - Reset Your Password';
      case 'email-verification':
        return 'FloNeo - Verify Your Email Address';
      default:
        return 'FloNeo - Verification Code';
    }
  }

  getOTPTemplate(otp, type) {
    const action = type === 'forgot-password' ? 'reset your password' : 'verify your email';
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">FloNeo LCNC Platform</h2>
        <p>Your verification code to ${action} is:</p>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #007bff; font-size: 32px; margin: 0;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">FloNeo LCNC Platform - Build applications without code</p>
      </div>
    `;
  }

  getInviteTemplate(projectName, inviteToken, inviterName) {
    const acceptUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/invites/${inviteToken}/accept`;
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">You're invited to collaborate!</h2>
        <p>${inviterName} has invited you to join the project "<strong>${projectName}</strong>" on FloNeo.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${acceptUrl}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Accept Invitation</a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="background: #f5f5f5; padding: 10px; word-break: break-all;">${acceptUrl}</p>
        <p>This invitation will expire in 7 days.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">FloNeo LCNC Platform - Build applications without code</p>
      </div>
    `;
  }

  getNotificationSubject(type) {
    switch (type) {
      case 'issue':
        return 'FloNeo - Critical Issue Alert';
      case 'system':
        return 'FloNeo - System Notification';
      case 'warning':
        return 'FloNeo - Warning Alert';
      case 'metric':
        return 'FloNeo - Metrics Update';
      case 'invite':
        return 'FloNeo - New Invitation';
      default:
        return 'FloNeo - Notification';
    }
  }

  getNotificationTemplate(type, message, userName) {
    const typeColors = {
      issue: '#dc3545',
      system: '#007bff',
      warning: '#ffc107',
      metric: '#28a745',
      invite: '#6f42c1'
    };

    const color = typeColors[type] || '#007bff';
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">FloNeo LCNC Platform</h2>
        <div style="background: ${color}; color: white; padding: 10px; border-radius: 4px; margin: 20px 0;">
          <h3 style="margin: 0;">${typeLabel} Notification</h3>
        </div>
        <p>Hello ${userName},</p>
        <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid ${color}; margin: 20px 0;">
          <p style="margin: 0;">${message}</p>
        </div>
        <p>Please log in to your FloNeo dashboard for more details.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard"
             style="background: ${color}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
            View Dashboard
          </a>
        </div>
        <hr>
        <p style="color: #666; font-size: 12px;">FloNeo LCNC Platform - Build applications without code</p>
      </div>
    `;
  }
}

module.exports = new EmailService();
