import { AppError } from './AppErrors';

export const ErrorMapper = {
  /**
   * Logs technical error details internally and maps the error to a user-friendly Arabic message.
   */
  toUserMessage(error: unknown, defaultFallbackAr = 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً'): string {
    // 1. Internal logging of technical trace details
    console.error('[ErrorMapper - Technical Trace]:', error);

    // 2. Map to user-friendly message
    if (error instanceof AppError) {
      return error.userMessageAr;
    }

    if (error instanceof Error) {
      const lowerMessage = error.message.toLowerCase();
      
      // Map standard database/network exceptions to friendly messages
      if (lowerMessage.includes('unauthorized') || lowerMessage.includes('permission denied')) {
        return 'عذراً، لا تملك صلاحية الوصول لتنفيذ هذا الإجراء.';
      }
      if (lowerMessage.includes('network') || lowerMessage.includes('fetch') || lowerMessage.includes('failed to connect')) {
        return 'تعذر الاتصال بالخادم، يرجى التحقق من جودة اتصالك بالإنترنت.';
      }
      if (lowerMessage.includes('duplicate key') || lowerMessage.includes('already exists')) {
        return 'هذا السجل متواجد بالفعل بالنظام مسبقاً.';
      }
      if (lowerMessage.includes('limit') || lowerMessage.includes('quota exceeded')) {
        return 'لقد تجاوزت الحد الأقصى المتاح لباقة اشتراكك الحالية.';
      }
      
      return error.message;
    }

    return defaultFallbackAr;
  }
};
