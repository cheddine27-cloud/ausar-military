import 'dart:convert';

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../services/connectivity_service.dart';
import '../../services/offline_service.dart';

class RegistrationPage extends StatefulWidget {
  final String sessionId;
  final String method;

  const RegistrationPage({
    super.key,
    required this.sessionId,
    required this.method,
  });

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage> {
  final _formKey = GlobalKey<FormState>();
  final _studentIdController = TextEditingController();
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  bool _isLoading = false;
  String? _error;
  String? _loadingHint; // ما الذي يحدث الآن (e.g. "جاري تحديد موقعك...")

  Future<String> _getDeviceId() async {
    final deviceInfo = DeviceInfoPlugin();

    if (kIsWeb) {
      final webInfo = await deviceInfo.webBrowserInfo;
      final fingerprint = [
        webInfo.browserName.name,
        webInfo.platform,
        webInfo.language,
        webInfo.vendor,
        webInfo.userAgent,
        webInfo.hardwareConcurrency.toString(),
      ].join('|');
      return 'web_${base64Encode(utf8.encode(fingerprint)).substring(0, 32)}';
    }

    if (defaultTargetPlatform == TargetPlatform.android) {
      final androidInfo = await deviceInfo.androidInfo;
      // ── Factory Reset Protection (v5.0.0) ─────────────────────────────
      // بصمة مركّبة من خصائص ثابتة لا تتغير مع إعادة ضبط المصنع:
      // brand + model + product + إصدار نظام التشغيل.
      // Android ID يتغير بعد Factory Reset، لذلك لا يعتمد عليه النظام
      // كأساس للتحقق — أصبح يُرسل منفصلًا ليتتبعه الخادم في سجل المعرّفات.
      final composite = [
        (androidInfo.brand ?? 'unknown').toLowerCase(),
        (androidInfo.model ?? 'unknown').toLowerCase(),
        (androidInfo.product ?? 'unknown').toLowerCase(),
        (androidInfo.version.release ?? 'unknown').toLowerCase(),
      ].join('|');
      return 'android_${composite.hashCode.toSigned(32).abs().toRadixString(16)}';
    }
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      final iosInfo = await deviceInfo.iosInfo;
      return iosInfo.identifierForVendor ?? 'unknown_ios';
    }
    if (defaultTargetPlatform == TargetPlatform.windows) {
      final windowsInfo = await deviceInfo.windowsInfo;
      return windowsInfo.deviceId;
    }
    return 'unknown_device';
  }

  /// يحاول جلب موقع الطالب بصمت. لا يفشل لو رفض الإذن أو تعطّل GPS —
  /// نُرسل null للخادم ونتركه يسجّل الحضور بدون مسافة. الأستاذ يراجع يدوياً.
  Future<Position?> _tryGetPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[location] service disabled');
        return null;
      }

      var permission = await Geolocator.checkPermission();
      debugPrint('[location] initial permission: $permission');
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        debugPrint('[location] after request: $permission');
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        return null;
      }

      // Try a fast last-known position first (instant, may be slightly stale)
      try {
        final last = await Geolocator.getLastKnownPosition();
        if (last != null) {
          debugPrint('[location] using last-known: ${last.latitude}, ${last.longitude}');
        }
      } catch (e) {
        debugPrint('[location] last-known failed: $e');
      }

      // Then try a fresh fix with reasonable accuracy and longer timeout.
      // 15s is enough for most devices to get GPS+network fix, even indoors.
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 15),
        ),
      );
      debugPrint('[location] fresh fix: ${pos.latitude}, ${pos.longitude}, accuracy=${pos.accuracy}m');
      return pos;
    } catch (e) {
      debugPrint('[location] error: $e');
      // Last resort: try last-known one more time before giving up
      try {
        return await Geolocator.getLastKnownPosition();
      } catch (_) {
        return null;
      }
    }
  }

  String _messageFromCode(String code, String fallback) {
    switch (code) {
      case 'QR_EXPIRED':
        return 'رمز QR منتهي الصلاحية';
      case 'QR_SESSION_MISMATCH':
        return 'رمز QR لا يتطابق مع الجلسة الحالية. أعد المسح';
      case 'SESSION_NOT_FOUND':
        return 'رمز الجلسة غير صحيح';
      case 'SESSION_CLOSED':
        return 'هذه الجلسة مغلقة حالياً';
      case 'SESSION_MISSING_INSTITUTION':
        return 'هذه الجلسة غير مكتملة الإعداد. الرجاء التواصل مع الأستاذ';
      case 'STUDENT_NOT_FOUND':
        return 'الرقم الجامعي غير موجود في هذه المؤسسة';
      case 'STUDENT_DATA_MISMATCH':
        return 'البيانات المدخلة لا تتطابق مع السجلات';
      case 'ALREADY_ATTENDED':
        return 'لقد سجلت حضورك مسبقاً في هذه الجلسة';
      case 'DEVICE_MISMATCH':
        return 'لديك جهاز مسجل مسبقاً. لا يمكنك استخدام جهاز جديد دون حذف القديم من الإدارة.';
      case 'DEVICE_USED_BY_OTHER_STUDENT':
        return 'هذا الجهاز مرتبط بطالب آخر';
      case 'MISSING_DEVICE':
        return 'تعذر التعرف على الجهاز. أعد فتح التطبيق';
      case 'MISSING_STUDENT_DATA':
        return 'بيانات الطالب غير مكتملة';
      case 'INVALID_METHOD':
        return 'طريقة التسجيل غير صحيحة';
      case 'LOCATION_REQUIRED':
        return 'هذه الجلسة تتطلب تفعيل الموقع الجغرافي';
      case 'OUT_OF_RANGE':
        return fallback; // لم يعد يحدث (advisory mode)، يبقى كاحتياط
      case 'LOCATION_REQUIRED':
        return 'تعذر تحديد موقعك. تحقق من تفعيل GPS وأذونات الموقع';
      case 'STUDENT_LOOKUP_FAILED':
      case 'SESSION_LOOKUP_FAILED':
      case 'DEVICE_LOOKUP_FAILED':
      case 'ATTENDANCE_INSERT_FAILED':
      case 'DEVICE_REGISTER_FAILED':
        return 'تعذر إكمال العملية. حاول مرة أخرى بعد قليل';
      default:
        return fallback;
    }
  }

  Future<Map<String, dynamic>> _invokeAttendance({
    required String deviceId,
    Position? position,
    String? rawAndroidId,
  }) async {
    late final FunctionResponse response;
    try {
      response = await Supabase.instance.client.functions.invoke(
        'register-attendance',
        body: {
          'sessionId': widget.sessionId,
          'sessionToken': widget.sessionId,
          'sessionCode': widget.method == 'code' ? widget.sessionId : null,
          'qrData': widget.method == 'qr' ? widget.sessionId : null,
          'method': widget.method,
          'studentNumber': _studentIdController.text.trim(),
          'firstName': _firstNameController.text.trim(),
          'lastName': _lastNameController.text.trim(),
          'deviceFingerprint': deviceId,
          if (rawAndroidId != null && rawAndroidId.isNotEmpty) 'androidId': rawAndroidId,
          'latitude': position?.latitude,
          'longitude': position?.longitude,
        },
      );
    } on FunctionException catch (error) {
      Map<String, dynamic>? detailsMap;
      final details = error.details;

      if (details is Map) {
        detailsMap = Map<String, dynamic>.from(details);
      } else if (details is String) {
        try {
          final decoded = jsonDecode(details);
          if (decoded is Map) {
            detailsMap = Map<String, dynamic>.from(decoded);
          }
        } catch (_) {
          // Keep null and fall back to generic message below.
        }
      }

      final errPayload = Map<String, dynamic>.from(detailsMap?['error'] as Map? ?? {});
      final code = errPayload['code']?.toString() ??
          (error.status == 428 ? 'LOCATION_REQUIRED' : 'FUNCTION_EXCEPTION');
      final fallback = errPayload['message']?.toString() ?? 'تعذر تسجيل الحضور';
      final message = _messageFromCode(code, fallback);
      throw {'code': code, 'message': message};
    }

    final data = Map<String, dynamic>.from(response.data as Map);
    if (data['ok'] == true) return data;

    final error = Map<String, dynamic>.from(data['error'] as Map? ?? {});
    final code = error['code']?.toString() ?? 'UNKNOWN';
    final message = _messageFromCode(code, error['message']?.toString() ?? 'تعذر تسجيل الحضور');
    throw {'code': code, 'message': message};
  }

  Future<void> _submitAttendance() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
      _loadingHint = 'جاري التحقق من الجهاز...';
    });

    try {
      final deviceId = await _getDeviceId();
      // ── Factory Reset Protection: إرسال Android ID الخام أيضًا ──────
      String? rawAndroidId;
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        try {
          rawAndroidId = (await DeviceInfoPlugin().androidInfo).id;
        } catch (_) {}
      }

      // نحاول جلب الموقع بصمت. لو فشل، نُرسل null — الخادم يقبل ويُسجّل
      // distance_meters=NULL، الأستاذ يراجع يدوياً.
      if (mounted) setState(() => _loadingHint = 'جاري تحديد موقعك...');

      final isOffline = _connectivity.currentStatus == ConnectivityStatus.offline;
      final position = await _tryGetPosition();

      // ── مزامنة غير المتصلة: لا شبكة → احفظ محليًا وانتهِ ──────────
      if (isOffline) {
        await _storeOfflineAttendance();
        return;
      }

      if (mounted) setState(() => _loadingHint = 'جاري تأكيد الحضور...');
      await _invokeAttendance(deviceId: deviceId, position: position, rawAndroidId: rawAndroidId);

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: const Icon(Icons.check_circle, color: Colors.green, size: 64),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'تم تسجيل حضورك بنجاح!',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.tajawal(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  'تم التحقق من بياناتك وجهازك',
                  style: GoogleFonts.tajawal(fontSize: 12, color: Colors.grey),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => context.go('/'),
                child: Text('العودة للرئيسية', style: GoogleFonts.tajawal()),
              ),
            ],
          ),
        );
      }
    } catch (error) {
      debugPrint('Attendance submission error: $error');

      // فشل الإرسال (غالبًا اتصال غير مستقر) → احفظ حضور الطالب محليًا
      // وسيُزامن تلقائيًا فور عودة الاتصال. الطالب لا يُحرم من تسجيل حضوره.
      await _storeOfflineAttendance();
      return;
    }
  }

  final _connectivity = ConnectivityService();
  final _offlineService = OfflineService();

  /// يجمع بصمة الجهاز و Android ID ويحفظ حضور الطالب في الطابور غير المتصل.
  ///
  /// يُستدعى من مساري الانقطاع (قبل الإرسال) والفشل (بعد سقوطه) — لذلك
  /// يقرأ الجهاز من جديد داخله ليكون متاحًا في كلتا الحالتين.
  Future<void> _storeOfflineAttendance() async {
    String deviceId;
    try {
      deviceId = await _getDeviceId();
    } catch (_) {
      deviceId = 'unknown';
    }

    String? rawAndroidId;
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      try {
        rawAndroidId = (await DeviceInfoPlugin().androidInfo).id;
      } catch (_) {}
    }

    Position? position;
    try {
      position = await _tryGetPosition();
    } catch (_) {
      position = null;
    }

    final qrData = widget.method == 'qr' ? widget.sessionId : '';
    await _offlineService.addRecordToOfflineQueue(OfflineAttendanceRecord(
      sessionId: widget.sessionId,
      sessionCode: widget.sessionId,
      method: widget.method == 'qr' ? 'qr' : 'code',
      qrData: qrData,
      studentNumber: _studentIdController.text.trim(),
      firstName: _firstNameController.text.trim(),
      lastName: _lastNameController.text.trim(),
      deviceFingerprint: deviceId,
      androidId: rawAndroidId,
      latitude: position?.latitude,
      longitude: position?.longitude,
      timestamp: DateTime.now(),
    ));

    final pending = await _offlineService.getOfflineQueueLength();

    if (mounted) {
      setState(() {
        _error = null;
        _isLoading = false;
        _loadingHint = null;
      });
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: const Icon(Icons.cloud_off, color: Colors.orange, size: 64),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'لا يوجد اتصال بالإنترنت',
                textAlign: TextAlign.center,
                style: GoogleFonts.tajawal(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'تم حفظ حضورك محليًا وسيتم إرساله تلقائيًا فور عودة الاتصال',
                textAlign: TextAlign.center,
                style: GoogleFonts.tajawal(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 8),
              Text(
                pending > 1 ? 'في الانتظار: $pending سجلات' : '',
                textAlign: TextAlign.center,
                style: GoogleFonts.tajawal(fontSize: 11, color: Colors.grey),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go('/');
              },
              child: Text('العودة للرئيسية', style: GoogleFonts.tajawal()),
            ),
          ],
        ),
      );
    }
  }

  @override
  void dispose() {
    _studentIdController.dispose();
    _firstNameController.dispose();
    _lastNameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowRight),
          onPressed: () => GoRouter.of(context).pop(),
          color: isDark ? Colors.white : Theme.of(context).colorScheme.primary,
        ),
        title: Column(
          children: [
            Text(
              'تسجيل الحضور',
              style: GoogleFonts.tajawal(
                color: isDark ? Colors.white : Theme.of(context).colorScheme.primary,
              ),
            ),
            Text(
              'SaaS Secure Attendance',
              style: TextStyle(fontSize: 10, color: isDark ? Colors.white70 : Colors.black54),
            ),
          ],
        ),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE),
              isDark ? const Color(0xFF1E293B) : const Color(0xFFF0FAFF),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 100),
          child: Card(
            elevation: 4,
            color: isDark ? const Color(0xFF1E293B) : Colors.white,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(24),
              side: BorderSide(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.transparent),
            ),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.person_add, size: 80, color: isDark ? Colors.blue.shade400 : const Color(0xFF2563EB)),
                    const SizedBox(height: 24),
                    Text(
                      'أدخل بياناتك للمتابعة',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.tajawal(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    const SizedBox(height: 32),
                    if (_error != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: Colors.red.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.withValues(alpha: 0.3)),
                        ),
                        child: Text(_error!, style: GoogleFonts.tajawal(color: Colors.red.shade400)),
                      ),
                    _buildInput(
                      controller: _studentIdController,
                      label: 'الرقم الجامعي',
                      icon: Icons.badge,
                      isDark: isDark,
                    ),
                    const SizedBox(height: 16),
                    _buildInput(
                      controller: _firstNameController,
                      label: 'الاسم',
                      icon: Icons.person,
                      isDark: isDark,
                    ),
                    const SizedBox(height: 16),
                    _buildInput(
                      controller: _lastNameController,
                      label: 'اللقب',
                      icon: Icons.person_outline,
                      isDark: isDark,
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _submitAttendance,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        backgroundColor: isDark ? Colors.blue.shade600 : null,
                      ),
                      child: _isLoading
                          ? Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const SizedBox(
                                  height: 22,
                                  width: 22,
                                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                                ),
                                if (_loadingHint != null) ...[
                                  const SizedBox(height: 8),
                                  Text(
                                    _loadingHint!,
                                    style: GoogleFonts.tajawal(
                                      fontSize: 12,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ],
                            )
                          : Text(
                              'تأكيد الحضور',
                              style: GoogleFonts.tajawal(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInput({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool isDark,
  }) {
    return TextFormField(
      controller: controller,
      style: TextStyle(color: isDark ? Colors.white : Colors.black),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(color: isDark ? Colors.white60 : Colors.black54),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: isDark ? Colors.white24 : Colors.grey.shade400),
        ),
        prefixIcon: Icon(icon, color: isDark ? Colors.blue.shade300 : Colors.blue),
      ),
      validator: (value) => value == null || value.trim().isEmpty ? 'هذا الحقل مطلوب' : null,
    );
  }
}
