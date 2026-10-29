import 'dart:async';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:student_app_flutter/services/connectivity_service.dart';

class StudentCodeEntryPage extends StatefulWidget {
  const StudentCodeEntryPage({super.key});

  @override
  State<StudentCodeEntryPage> createState() => _StudentCodeEntryPageState();
}

class _StudentCodeEntryPageState extends State<StudentCodeEntryPage> {
  final _formKey = GlobalKey<FormState>();
  final _codeController = TextEditingController();
  late StreamSubscription<ConnectivityStatus> _connectivitySubscription;
  bool _isOnline = connectivityService.currentStatus == ConnectivityStatus.online;
  bool _isLoading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _connectivitySubscription = connectivityService.statusStream.listen((status) {
      if (mounted) {
        setState(() => _isOnline = status == ConnectivityStatus.online);
      }
    });
  }

  Future<void> _handleSubmit() async {
    if (_isLoading || !_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final code = Uri.encodeComponent(_codeController.text.trim().toUpperCase());
      if (mounted) context.push('/register?sessionId=$code&method=code');
    } catch (_) {
      setState(() => _error = 'حدث خطأ أثناء فتح صفحة التسجيل');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _connectivitySubscription.cancel();
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
        title: Text(
          'إدخال رمز الجلسة',
          style: GoogleFonts.tajawal(
            color: isDark ? Colors.white : Theme.of(context).colorScheme.primary,
          ),
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
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Card(
              elevation: 4,
              color: isDark ? const Color(0xFF1E293B) : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Icon(LucideIcons.keyboard, size: 72, color: Colors.blue.shade500),
                      const SizedBox(height: 20),
                      Text(
                        'أدخل رمز الجلسة',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.tajawal(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _isOnline
                            ? 'سيتم التحقق النهائي عند تأكيد الحضور'
                            : 'وضع أوفلاين: سيتم حفظ الحضور محليا',
                        textAlign: TextAlign.center,
                        style: GoogleFonts.tajawal(
                          color: _isOnline ? Colors.blue.shade600 : Colors.orange.shade600,
                        ),
                      ),
                      const SizedBox(height: 24),
                      if (_error != null) ...[
                        Text(_error!, style: TextStyle(color: Colors.red.shade400)),
                        const SizedBox(height: 12),
                      ],
                      TextFormField(
                        controller: _codeController,
                        textAlign: TextAlign.center,
                        textCapitalization: TextCapitalization.characters,
                        style: GoogleFonts.sourceCodePro(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 4,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                        decoration: InputDecoration(
                          labelText: 'رمز الجلسة',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        maxLength: 6,
                        validator: (value) =>
                            value == null || value.trim().isEmpty ? 'هذا الحقل مطلوب' : null,
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleSubmit,
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 50),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(
                          _isLoading ? 'جاري الفتح...' : 'متابعة',
                          style: GoogleFonts.tajawal(fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
