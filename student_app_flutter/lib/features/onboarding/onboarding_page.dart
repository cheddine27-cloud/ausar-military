import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Marker stored in SharedPreferences once the user completes onboarding.
/// We don't gate on permission status (user may revoke later) — only on the
/// fact that we've shown the screen at least once.
const String kOnboardingDoneKey = 'q_hudoor_onboarding_done_v1';

/// Returns true on first launch (or after the user clears app data).
Future<bool> shouldShowOnboarding() async {
  final prefs = await SharedPreferences.getInstance();
  return !(prefs.getBool(kOnboardingDoneKey) ?? false);
}

Future<void> markOnboardingDone() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setBool(kOnboardingDoneKey, true);
}

/// First-launch screen that walks the student through the two permissions
/// the app needs (Camera + Location) before reaching the main UI.
class OnboardingPage extends StatefulWidget {
  const OnboardingPage({super.key});

  @override
  State<OnboardingPage> createState() => _OnboardingPageState();
}

class _OnboardingPageState extends State<OnboardingPage> {
  int _step = 0; // 0 = welcome, 1 = camera, 2 = location, 3 = done

  PermissionStatus _cameraStatus = PermissionStatus.denied;
  PermissionStatus _locationStatus = PermissionStatus.denied;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _refreshStatuses();
  }

  Future<void> _refreshStatuses() async {
    final cam = await Permission.camera.status;
    final loc = await Permission.locationWhenInUse.status;
    if (mounted) {
      setState(() {
        _cameraStatus = cam;
        _locationStatus = loc;
      });
    }
  }

  Future<void> _requestCamera() async {
    setState(() => _busy = true);
    final result = await Permission.camera.request();
    setState(() {
      _cameraStatus = result;
      _busy = false;
    });
  }

  Future<void> _requestLocation() async {
    setState(() => _busy = true);
    final result = await Permission.locationWhenInUse.request();
    setState(() {
      _locationStatus = result;
      _busy = false;
    });
  }

  Future<void> _finish() async {
    await markOnboardingDone();
    if (!mounted) return;
    context.go('/');
  }

  void _next() {
    if (_step < 3) setState(() => _step++);
  }

  void _back() {
    if (_step > 0) setState(() => _step--);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgStart = isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE);
    final bgEnd = isDark ? const Color(0xFF1E293B) : const Color(0xFFF0FAFF);

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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            child: Column(
              children: [
                _buildProgress(isDark),
                const SizedBox(height: 24),
                Expanded(
                  child: AnimatedSwitcher(
                    duration: const Duration(milliseconds: 320),
                    child: _buildStep(isDark),
                  ),
                ),
                _buildBottomBar(isDark),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildProgress(bool isDark) {
    return Row(
      children: List.generate(4, (index) {
        final active = index <= _step;
        return Expanded(
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 3),
            height: 4,
            decoration: BoxDecoration(
              color: active
                  ? const Color(0xFF2563EB)
                  : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.shade200),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildStep(bool isDark) {
    switch (_step) {
      case 0:
        return _buildWelcome(isDark);
      case 1:
        return _buildCameraStep(isDark);
      case 2:
        return _buildLocationStep(isDark);
      case 3:
      default:
        return _buildDoneStep(isDark);
    }
  }

  Widget _buildWelcome(bool isDark) {
    return Column(
      key: const ValueKey('welcome'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 110,
          height: 110,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [Color(0xFF3B82F6), Color(0xFF06B6D4)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: const Icon(LucideIcons.qrCode, color: Colors.white, size: 56),
        ),
        const SizedBox(height: 28),
        Text(
          'مرحباً بك في Ausar Military',
          textAlign: TextAlign.center,
          style: GoogleFonts.tajawal(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: isDark ? Colors.white : const Color(0xFF1E40AF),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'نظام الحضور الذكي\nسجّل حضورك بمسح QR في ثوانٍ',
          textAlign: TextAlign.center,
          style: GoogleFonts.tajawal(
            fontSize: 15,
            height: 1.6,
            color: isDark ? Colors.white70 : Colors.grey.shade600,
          ),
        ),
        const SizedBox(height: 32),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.04) : const Color(0xFFEFF6FF),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFBFDBFE),
            ),
          ),
          child: Column(
            children: [
              _buildInfoRow(LucideIcons.camera, 'الكاميرا', 'لمسح رمز QR من شاشة الأستاذ', isDark),
              const SizedBox(height: 12),
              _buildInfoRow(LucideIcons.mapPin, 'الموقع', 'لتسجيل المسافة من القاعة (اختياري)', isDark),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInfoRow(IconData icon, String title, String desc, bool isDark) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: const Color(0xFF2563EB).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(LucideIcons.check, color: Color(0xFF2563EB), size: 18),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.tajawal(
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              Text(
                desc,
                style: GoogleFonts.tajawal(
                  fontSize: 12,
                  color: isDark ? Colors.white60 : Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildPermissionCard({
    required IconData icon,
    required String title,
    required String description,
    required String reason,
    required PermissionStatus status,
    required VoidCallback onRequest,
    required bool isDark,
  }) {
    final granted = status.isGranted || status.isLimited;
    final permanentlyDenied = status.isPermanentlyDenied;

    return Column(
      key: ValueKey(title),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 110,
          height: 110,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: granted
                ? const Color(0xFF10B981).withValues(alpha: 0.15)
                : const Color(0xFF2563EB).withValues(alpha: 0.12),
          ),
          child: Icon(
            granted ? LucideIcons.circleCheck : icon,
            color: granted ? const Color(0xFF10B981) : const Color(0xFF2563EB),
            size: 56,
          ),
        ),
        const SizedBox(height: 24),
        Text(
          title,
          textAlign: TextAlign.center,
          style: GoogleFonts.tajawal(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 10),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8),
          child: Text(
            description,
            textAlign: TextAlign.center,
            style: GoogleFonts.tajawal(
              fontSize: 14,
              height: 1.6,
              color: isDark ? Colors.white70 : Colors.grey.shade600,
            ),
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.04) : const Color(0xFFFFFBEB),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.08) : const Color(0xFFFDE68A),
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(LucideIcons.info, size: 18, color: isDark ? Colors.amber.shade300 : Colors.amber.shade700),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  reason,
                  style: GoogleFonts.tajawal(
                    fontSize: 12,
                    height: 1.5,
                    color: isDark ? Colors.amber.shade100 : Colors.amber.shade900,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        if (granted)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.check, color: Color(0xFF10B981), size: 16),
                const SizedBox(width: 6),
                Text(
                  'تم منح الإذن',
                  style: GoogleFonts.tajawal(
                    color: const Color(0xFF10B981),
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          )
        else if (permanentlyDenied)
          Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.red.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'الإذن مرفوض دائماً — افتح الإعدادات',
                  style: GoogleFonts.tajawal(color: Colors.red.shade400, fontSize: 11),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: () => openAppSettings(),
                icon: const Icon(LucideIcons.settings, size: 16),
                label: Text('فتح إعدادات التطبيق', style: GoogleFonts.tajawal()),
              ),
            ],
          )
        else
          ElevatedButton.icon(
            onPressed: _busy ? null : onRequest,
            icon: const Icon(LucideIcons.shieldCheck, size: 18),
            label: Text(
              _busy ? 'جاري الطلب...' : 'منح الإذن',
              style: GoogleFonts.tajawal(fontWeight: FontWeight.bold),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
      ],
    );
  }

  Widget _buildCameraStep(bool isDark) {
    return _buildPermissionCard(
      icon: LucideIcons.camera,
      title: 'إذن الكاميرا',
      description: 'نحتاج الكاميرا لمسح رمز QR\nالمعروض على شاشة الأستاذ',
      reason:
          'لن يتم استخدام الكاميرا إلا أثناء عملية تسجيل الحضور. لا يتم تخزين أو إرسال أي صور.',
      status: _cameraStatus,
      onRequest: _requestCamera,
      isDark: isDark,
    );
  }

  Widget _buildLocationStep(bool isDark) {
    return _buildPermissionCard(
      icon: LucideIcons.mapPin,
      title: 'إذن الموقع',
      description: 'لقياس المسافة بين موقعك\nوالقاعة وقت تسجيل الحضور',
      reason:
          'الموقع يُستخدم فقط أثناء تسجيل الحضور لتأكيد قربك من القاعة. الحضور لن يُرفض حتى لو فشل تحديد الموقع — الأستاذ يراجع يدوياً.',
      status: _locationStatus,
      onRequest: _requestLocation,
      isDark: isDark,
    );
  }

  Widget _buildDoneStep(bool isDark) {
    return Column(
      key: const ValueKey('done'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Container(
          width: 120,
          height: 120,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF10B981).withValues(alpha: 0.15),
          ),
          child: const Icon(LucideIcons.circleCheck, color: Color(0xFF10B981), size: 70),
        ),
        const SizedBox(height: 28),
        Text(
          'كل شيء جاهز!',
          textAlign: TextAlign.center,
          style: GoogleFonts.tajawal(
            fontSize: 28,
            fontWeight: FontWeight.w900,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'يمكنك الآن البدء في تسجيل حضورك\nبأمان وسرعة',
          textAlign: TextAlign.center,
          style: GoogleFonts.tajawal(
            fontSize: 15,
            height: 1.6,
            color: isDark ? Colors.white70 : Colors.grey.shade600,
          ),
        ),
      ],
    );
  }

  Widget _buildBottomBar(bool isDark) {
    final isWelcome = _step == 0;
    final isFinal = _step == 3;
    final isCameraStep = _step == 1;
    final isLocationStep = _step == 2;
    // Don't block progress on permission status — student can proceed even if
    // permission was denied (location is optional, camera will re-prompt later
    // when scanning).
    final canContinue = !_busy;

    return Padding(
      padding: const EdgeInsets.only(top: 8, bottom: 4),
      child: Row(
        children: [
          if (!isWelcome)
            TextButton(
              onPressed: _busy ? null : _back,
              child: Text(
                'رجوع',
                style: GoogleFonts.tajawal(
                  color: isDark ? Colors.white70 : Colors.grey.shade600,
                ),
              ),
            )
          else
            const SizedBox(width: 64),
          const Spacer(),
          if (isCameraStep || isLocationStep)
            TextButton(
              onPressed: _busy ? null : _next,
              child: Text(
                'تخطّي',
                style: GoogleFonts.tajawal(
                  color: isDark ? Colors.white60 : Colors.grey.shade500,
                ),
              ),
            ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: canContinue
                ? () {
                    if (isFinal) {
                      _finish();
                    } else {
                      _next();
                    }
                  }
                : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              isFinal ? 'ابدأ الآن' : (isWelcome ? 'التالي' : 'التالي'),
              style: GoogleFonts.tajawal(fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );
  }
}
