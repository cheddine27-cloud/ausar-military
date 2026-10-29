import { supabase } from './supabase';

export interface CreateAdminAuthUserInput {
  email: string;
  password: string;
  username: string;
  fullName?: string | null;
  role: 'super_admin' | 'teacher';
}

export async function createAdminAuthUser(input: CreateAdminAuthUserInput): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const currentSession = sessionData.session;

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        username: input.username,
        full_name: input.fullName || input.username,
        role: input.role,
      },
    },
  });

  if (currentSession) {
    await supabase.auth.setSession({
      access_token: currentSession.access_token,
      refresh_token: currentSession.refresh_token,
    });
  }

  if (error) throw error;
  if (!data.user?.id) throw new Error('تعذر إنشاء مستخدم Supabase Auth');

  return data.user.id;
}
