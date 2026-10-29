import { supabase } from '@/lib/supabase';

export interface QueueNotificationParams {
  institutionId: string;
  senderAdminId: string | null;
  recipientType: 'parent' | 'student' | 'admin' | 'professor';
  recipientId: string;
  recipientContact: string;
  channel: 'sms' | 'email' | 'whatsapp';
  message: string;
  messageSnapshot: string;
  notificationCode: string;
  subject?: string | null;
  notes?: string | null;
}

export const NotificationService = {
  /**
   * Queues a notification in the database communication_queue table.
   */
  async queue(params: QueueNotificationParams): Promise<{ success: boolean; id?: string }> {
    try {
      const { data, error } = await supabase
        .from('communication_queue')
        .insert({
          institution_id: params.institutionId,
          sender_admin_id: params.senderAdminId,
          recipient_type: params.recipientType,
          recipient_id: params.recipientId,
          recipient_contact: params.recipientContact,
          channel: params.channel,
          message: params.message,
          message_snapshot: params.messageSnapshot,
          notification_code: params.notificationCode,
          subject: params.subject || null,
          notes: params.notes || null,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) {
        console.error('NotificationService.queue failed:', error);
        return { success: false };
      }
      return { success: true, id: data.id };
    } catch (e) {
      console.error('NotificationService: Exception during queue:', e);
      return { success: false };
    }
  },

  /**
   * Updates status for a queued item (e.g. after simulation gateway fires).
   */
  async updateStatus(
    id: string,
    status: 'sent' | 'delivered' | 'failed',
    providerResponse: unknown
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('communication_queue')
        .update({
          status,
          processed_at: new Date().toISOString(),
          provider_response: providerResponse,
        })
        .eq('id', id);

      if (error) {
        console.error('NotificationService.updateStatus failed:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('NotificationService: Exception during updateStatus:', e);
      return false;
    }
  }
};
