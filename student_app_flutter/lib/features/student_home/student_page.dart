import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:student_app_flutter/main.dart'; // Import themeProvider

class StudentPage extends StatelessWidget {
  const StudentPage({super.key});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    // Gradient colors from the web version
    const gradientStart = Color(0xFF3B82F6); // blue-500
    const gradientEnd = Color(0xFF06B6D4); // cyan-500

    // Dynamic background colors
    final bgStart = isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE);
    final bgEnd = isDark ? const Color(0xFF1E293B) : const Color(0xFFCFFAFE);

    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(
            icon: Icon(isDark ? LucideIcons.sun : LucideIcons.moon),
            onPressed: () => themeProvider.toggleTheme(),
            tooltip: isDark ? 'الوضع الفاتح' : 'الوضع الليلي',
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [bgStart, bgEnd],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Card(
                    elevation: 8.0,
                    shadowColor: Colors.blue.withValues(alpha: 0.2),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24.0)),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          // QR Icon
                          Container(
                            width: 96,
                            height: 96,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: LinearGradient(
                                colors: [gradientStart, gradientEnd],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black26,
                                  blurRadius: 10,
                                  offset: Offset(0, 4),
                                )
                              ],
                            ),
                            child: const Icon(LucideIcons.qrCode, color: Colors.white, size: 48),
                          ),
                          const SizedBox(height: 24),

                          // Title
                          Text(
                            'Ausar Military',
                            style: GoogleFonts.tajawal(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : const Color(0xFF1E40AF),
                            ),
                          ),
                          Text(
                            'تسجيل الحضور',
                             style: GoogleFonts.tajawal(
                              fontSize: 22,
                              fontWeight: FontWeight.w600,
                              color: isDark ? Colors.white70 : Colors.grey[800],
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'مرحباً بك في نظام الحضور الذكي',
                             style: GoogleFonts.tajawal(
                              fontSize: 18,
                              color: isDark ? Colors.white60 : Colors.grey[600],
                            ),
                            textAlign: TextAlign.center,
                          ),
                          const SizedBox(height: 24),

                          // Info Box
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: isDark ? Colors.white.withValues(alpha: 0.05) : const Color(0xFFEFF6FF),
                              border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.1) : const Color(0xFFBFDBFE)),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Column(
                              children: [
                                Text(
                                  '✓ مسح QR Code سريع',
                                  style: GoogleFonts.tajawal(
                                    color: isDark ? Colors.blue.shade200 : const Color(0xFF1E3A8A),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '✓ أو إدخال رمز الجلسة يدوياً',
                                  style: GoogleFonts.tajawal(
                                    color: isDark ? Colors.blue.shade200 : const Color(0xFF1E3A8A),
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),

                          // Start Button
                          ElevatedButton(
                            onPressed: () {
                              GoRouter.of(context).push('/scan');
                            },
                            style: ElevatedButton.styleFrom(
                              padding: EdgeInsets.zero,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 5,
                            ),
                            child: Ink(
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [gradientStart, gradientEnd],
                                ),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Container(
                                width: double.infinity,
                                alignment: Alignment.center,
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                child: Text(
                                  'ابدأ الآن',
                                  style: GoogleFonts.tajawal(
                                    fontSize: 18,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Footer
                  Column(
                    children: [
                      Text(
                        '🎓 نظام آمن وموثوق | Secure & Reliable',
                         style: GoogleFonts.tajawal(
                          fontSize: 14,
                          color: isDark ? Colors.white54 : Colors.grey[500],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Developed by Seif',
                        style: GoogleFonts.tajawal(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.blue.shade300 : Colors.blue.shade700,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
