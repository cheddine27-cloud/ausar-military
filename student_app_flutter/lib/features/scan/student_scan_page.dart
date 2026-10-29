import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:student_app_flutter/services/connectivity_service.dart';

class StudentScanPage extends StatelessWidget {
  const StudentScanPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgStart = isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE);
    final bgEnd = isDark ? const Color(0xFF1E293B) : const Color(0xFFCFFAFE);

    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [bgStart, bgEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: ListView( // Using ListView to avoid overflow
            padding: const EdgeInsets.all(16.0),
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => GoRouter.of(context).pop(),
                  icon: const Icon(LucideIcons.arrowRight),
                  label: Text('رجوع', style: GoogleFonts.tajawal()),
                   style: TextButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.primary,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              // I will add offline/sync status widgets here later
              // سأضيف واجهات حالة الاتصال والمزامنة هنا لاحقًا
              
              Text(
                'اختر طريقة التسجيل',
                textAlign: TextAlign.center,
                style: GoogleFonts.tajawal(
                  fontSize: 30,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : const Color(0xFF1E40AF),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'يمكنك المسح بالكاميرا أو إدخال الرمز يدوياً',
                textAlign: TextAlign.center,
                style: GoogleFonts.tajawal(fontSize: 18, color: isDark ? Colors.white70 : Colors.grey[600]),
              ),
              const SizedBox(height: 24),

              // Using LayoutBuilder for responsiveness
              LayoutBuilder(
                builder: (context, constraints) {
                  final isWide = constraints.maxWidth > 600;
                  final children = [
                    _buildChoiceCard(
                      context: context,
                      isDark: isDark,
                      title: 'مسح QR Code',
                      description: 'استخدم كاميرا الجهاز لمسح الرمز',
                      icon: LucideIcons.qrCode,
                      iconGradient: const [Color(0xFF3B82F6), Color(0xFF06B6D4)],
                      buttonText: 'فتح الكاميرا',
                      onTap: () => GoRouter.of(context).push('/qr-scanner'),
                    ),
                    _buildChoiceCard(
                      context: context,
                      isDark: isDark,
                      title: 'إدخال الرمز',
                      description: 'أدخل رمز الجلسة يدوياً',
                      icon: LucideIcons.keyboard,
                      iconGradient: const [Color(0xFF06B6D4), Color(0xFF3B82F6)],
                      buttonText: 'إدخال الرمز',
                      isOutlineButton: true,
                      onTap: () => GoRouter.of(context).push('/code-entry'),
                    ),
                  ];

                  if (isWide) {
                    return Row(
                      children: [
                        Expanded(child: children[0]),
                        const SizedBox(width: 16),
                        Expanded(child: children[1]),
                      ],
                    );
                  } else {
                    return Column(
                      children: [
                        children[0],
                        const SizedBox(height: 16),
                        children[1],
                      ],
                    );
                  }
                },
              ),
                const SizedBox(height: 24),
                StreamBuilder<ConnectivityStatus>(
                  stream: connectivityService.statusStream,
                  initialData: connectivityService.currentStatus,
                  builder: (context, snapshot) {
                    final isOnline = snapshot.data == ConnectivityStatus.online;
                    return Text(
                      isOnline ? '💡 متصل بالإنترنت' : '⚠️ وضع غير متصل بالإنترنت',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.tajawal(
                        color: isOnline 
                          ? (isDark ? Colors.blue.shade300 : Colors.blue.shade700)
                          : (isDark ? Colors.orange.shade300 : Colors.orange.shade700),
                        fontWeight: FontWeight.bold,
                      ),
                    );
                  },
                )
              ],
            ),
          ),
        ),
      );
  }

  Widget _buildChoiceCard({
    required BuildContext context,
    required bool isDark,
    required String title,
    required String description,
    required IconData icon,
    required List<Color> iconGradient,
    required String buttonText,
    required VoidCallback onTap,
    bool isOutlineButton = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        elevation: 4.0,
        shadowColor: Colors.blue.withValues(alpha: 0.1),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(24.0),
          side: BorderSide(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey[200]!, 
            width: 1
          ),
        ),
        color: isDark ? const Color(0xFF1E293B) : Colors.white,
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: iconGradient,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                child: Icon(icon, color: Colors.white, size: 48),
              ),
              const SizedBox(height: 16),
              Text(title, style: GoogleFonts.tajawal(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.grey[900])),
              const SizedBox(height: 8),
              Text(description, style: GoogleFonts.tajawal(fontSize: 16, color: isDark ? Colors.white60 : Colors.grey[600]), textAlign: TextAlign.center,),
              const SizedBox(height: 24),
              if (isOutlineButton)
                OutlinedButton(
                  onPressed: onTap,
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    foregroundColor: Theme.of(context).colorScheme.primary,
                    side: BorderSide(color: Theme.of(context).colorScheme.primary, width: 2),
                     shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.0),
                    ),
                  ),
                  child: Text(buttonText, style: GoogleFonts.tajawal(fontWeight: FontWeight.bold)),
                )
              else
                ElevatedButton(
                  onPressed: onTap,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                     shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12.0),
                    ),
                  ),
                  child: Text(buttonText, style: GoogleFonts.tajawal(fontWeight: FontWeight.bold)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
