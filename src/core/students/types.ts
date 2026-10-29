export type GuardianRelationship = 'father' | 'mother' | 'guardian';
export type PreferredChannel = 'sms' | 'email' | 'whatsapp';

export interface StudentGuardian {
  id: string;
  student_id: string;
  institution_id: string;
  name: string;
  relationship: GuardianRelationship;
  phone: string | null;
  email: string | null;
  preferred_channel: PreferredChannel;
  receive_sms: boolean;
  receive_whatsapp: boolean;
  receive_email: boolean;
  created_at?: string;
}
