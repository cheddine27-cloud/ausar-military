import { supabase } from '@/lib/supabase';
import type { StudentGuardian } from '../types';

/**
 * Fetch all parent contacts (guardians) associated with a given student ID.
 */
export async function getParentContacts(studentId: string): Promise<StudentGuardian[]> {
  const { data, error } = await supabase
    .from('student_parent_contacts')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getParentContacts failed:', error);
    return [];
  }
  return (data || []) as StudentGuardian[];
}

/**
 * Insert or update a parent contact (guardian).
 */
export async function saveParentContact(contact: Partial<StudentGuardian> & { student_id: string; institution_id: string }): Promise<boolean> {
  const payload = {
    id: contact.id || undefined,
    student_id: contact.student_id,
    institution_id: contact.institution_id,
    name: contact.name?.trim(),
    relationship: contact.relationship,
    phone: contact.phone?.trim() || null,
    email: contact.email?.trim() || null,
    preferred_channel: contact.preferred_channel || 'sms',
    receive_sms: contact.receive_sms !== false,
    receive_whatsapp: contact.receive_whatsapp !== false,
    receive_email: contact.receive_email !== false,
  };

  const { error } = await supabase
    .from('student_parent_contacts')
    .upsert(payload);

  if (error) {
    console.error('saveParentContact failed:', error);
    return false;
  }
  return true;
}

/**
 * Remove a parent contact record.
 */
export async function deleteParentContact(contactId: string): Promise<boolean> {
  const { error } = await supabase
    .from('student_parent_contacts')
    .delete()
    .eq('id', contactId);

  if (error) {
    console.error('deleteParentContact failed:', error);
    return false;
  }
  return true;
}
