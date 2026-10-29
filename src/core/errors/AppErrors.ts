/**
 * Ausar Military — Centralized App Error Classes
 */

export class AppError extends Error {
  public code: string;
  public userMessageAr: string;

  constructor(message: string, code: string, userMessageAr: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.userMessageAr = userMessageAr;
  }
}

export class ApiError extends AppError {
  constructor(message: string, userMessageAr = 'حدث خطأ أثناء الاتصال بقاعدة البيانات أو الخادم') {
    super(message, 'API_ERROR', userMessageAr);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, userMessageAr = 'البيانات المدخلة غير صالحة، يرجى التحقق وإعادة المحاولة') {
    super(message, 'VALIDATION_ERROR', userMessageAr);
  }
}

export class PermissionError extends AppError {
  constructor(message: string, userMessageAr = 'ليس لديك الصلاحيات الكافية لتنفيذ هذه العملية') {
    super(message, 'PERMISSION_ERROR', userMessageAr);
  }
}

export class WorkflowError extends AppError {
  constructor(message: string, userMessageAr = 'تعذر تنفيذ الإجراء المطلوب بمسار العمل الحالي') {
    super(message, 'WORKFLOW_ERROR', userMessageAr);
  }
}

export class NotificationError extends AppError {
  constructor(message: string, userMessageAr = 'تعذر إرسال أو جدولة الإشعار المطلوب') {
    super(message, 'NOTIFICATION_ERROR', userMessageAr);
  }
}
