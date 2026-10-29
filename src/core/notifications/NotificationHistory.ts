import { supabase } from '@/lib/supabase';

export const NotificationHistory = {
  /**
   * Retrieves the global history of queued and sent notifications for an institution.
   */
  async getHistory(institutionId: string, searchQuery?: string) {
    let query = supabase
      .from('communication_queue')
      .select('*')
      .eq('institution_id', institutionId)
      .order('created_at', { ascending: false });

    if (searchQuery) {
      const trimmed = searchQuery.trim();
      if (trimmed.toUpperCase().includes('GC-')) {
        query = query.ilike('notification_code', `%${trimmed}%`);
      } else {
        query = query.or(
          `recipient_contact.ilike.%${trimmed}%,notes.ilike.%${trimmed}%,message_snapshot.ilike.%${trimmed}%`
        );
      }
    }

    const { data, error } = await query;
    if (error) {
      console.error('NotificationHistory.getHistory failed:', error);
      return [];
    }
    return data || [];
  }
};
