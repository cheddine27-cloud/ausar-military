import { NotificationService } from './NotificationService';
import { NotificationProviders } from './NotificationProviders';

export interface SendNotificationParams {
  institutionId: string;
  senderAdminId: string | null;
  recipientType: 'parent' | 'student' | 'admin' | 'professor';
  recipientId: string;
  recipientContact: string;
  channel: 'sms' | 'email' | 'whatsapp';
  message: string;
  subject?: string | null;
  notes?: string | null;
  notificationCode: string;
}

export const NotificationEngine = {
  /**
   * Main entry point to send and queue a notification.
   * Performs the database queue entry, simulates gateway dispatch, and logs results.
   */
  async send(params: SendNotificationParams): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      // 1. Queue in database
      const queueResult = await NotificationService.queue({
        institutionId: params.institutionId,
        senderAdminId: params.senderAdminId,
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        recipientContact: params.recipientContact,
        channel: params.channel,
        message: params.message,
        messageSnapshot: params.message, // Preserve original snapshot
        notificationCode: params.notificationCode,
        subject: params.subject,
        notes: params.notes,
      });

      if (!queueResult.success || !queueResult.id) {
        return { success: false, error: 'تعذر إدراج الإشعار في طابور الإرسال' };
      }

      // 2. Dispatch asynchronously (non-blocking simulation)
      void this.dispatchGateway(queueResult.id, params);

      return { success: true, id: queueResult.id };
    } catch (e) {
      const err = e as Error;
      console.error('NotificationEngine.send failed:', err);
      return { success: false, error: err.message || 'خطأ أثناء معالجة الإشعار' };
    }
  },

  /**
   * Internal helper to dispatch gateway requests asynchronously.
   */
  async dispatchGateway(queueId: string, params: SendNotificationParams): Promise<void> {
    try {
      let response;
      switch (params.channel) {
        case 'sms':
          response = await NotificationProviders.sendSMS(params.recipientContact, params.message);
          break;
        case 'whatsapp':
          response = await NotificationProviders.sendWhatsApp(params.recipientContact, params.message);
          break;
        case 'email':
          response = await NotificationProviders.sendEmail(
            params.recipientContact,
            params.subject || 'تنبيه من Ausar Military',
            params.message
          );
          break;
        default:
          response = { success: false, gateway: 'None', error: 'Unsupported channel' };
      }

      const status = response.success ? 'delivered' : 'failed';
      await NotificationService.updateStatus(queueId, status, response);
    } catch (e) {
      const err = e as Error;
      console.error(`NotificationEngine: Failed to dispatch gateway for queue ID ${queueId}:`, err);
      await NotificationService.updateStatus(queueId, 'failed', { error: err.message || 'Gateway connection error' });
    }
  }
};
