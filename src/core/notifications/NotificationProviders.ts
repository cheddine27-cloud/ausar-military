/**
 * Ausar Military — Notification Channel Providers
 *
 * Simulates gateway provider dispatching for SMS, WhatsApp, and Email,
 * with standard stubs for future Native Push Notification integration.
 */

export interface ProviderResponse {
  success: boolean;
  messageId?: string;
  gateway: string;
  error?: string;
}

export const NotificationProviders = {
  /**
   * SMS Gateway Provider (Simulated)
   */
  async sendSMS(phone: string, message: string): Promise<ProviderResponse> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 150));
    const messageId = `sms_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      messageId,
      gateway: 'Teleconnect-SMS-Gateway',
    };
  },

  /**
   * WhatsApp Gateway Provider (Simulated)
   */
  async sendWhatsApp(phone: string, message: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const messageId = `wa_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      messageId,
      gateway: 'Meta-WhatsApp-Cloud-API',
    };
  },

  /**
   * Email Gateway Provider (Simulated)
   */
  async sendEmail(email: string, subject: string, body: string): Promise<ProviderResponse> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const messageId = `mail_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      messageId,
      gateway: 'SendGrid-SMTP-Relay',
    };
  },

  /**
   * Push Notification Provider Stub (Future Extension)
   */
  async sendPush(deviceId: string, title: string, body: string): Promise<ProviderResponse> {
    return {
      success: true,
      messageId: `push_${Math.random().toString(36).substr(2, 9)}`,
      gateway: 'Firebase-Cloud-Messaging',
    };
  }
};
