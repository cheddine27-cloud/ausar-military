// Zod schemas للتحقق من المدخلات

import { z } from 'zod';

export const studentRegisterSchema = z.object({
  studentNumber: z.string().min(1, 'الرقم الجامعي مطلوب'),
  firstName: z.string().min(1, 'الاسم مطلوب'),
  lastName: z.string().min(1, 'اللقب مطلوب'),
  additionalField: z.string().optional(),
});

export const cohortSchema = z.object({
  name: z.string().min(1, 'اسم الفوج مطلوب'),
  description: z.string().optional(),
});

export const studentSchema = z.object({
  studentNumber: z.string().min(1, 'الرقم الجامعي مطلوب'),
  firstName: z.string().min(1, 'الاسم مطلوب'),
  lastName: z.string().min(1, 'اللقب مطلوب'),
  cohortId: z.string().min(1, 'الفوج مطلوب'),
  additionalField: z.string().optional(),
});

export const sessionSchema = z.object({
  cohortId: z.string().min(1, 'الفوج مطلوب'),
  title: z.string().min(1, 'عنوان الجلسة مطلوب'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
});

export type StudentRegisterInput = z.infer<typeof studentRegisterSchema>;
export type CohortInput = z.infer<typeof cohortSchema>;
export type StudentInput = z.infer<typeof studentSchema>;
export type SessionInput = z.infer<typeof sessionSchema>;
export type LoginInput = z.infer<typeof loginSchema>;