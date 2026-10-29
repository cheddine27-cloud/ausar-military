import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_flutter/lucide_flutter.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class StudentQRScannerPage extends StatefulWidget {
  const StudentQRScannerPage({super.key});

  @override
  State<StudentQRScannerPage> createState() => _StudentQRScannerPageState();
}

class _StudentQRScannerPageState extends State<StudentQRScannerPage> {
  final MobileScannerController _scannerController = MobileScannerController(
    facing: CameraFacing.back,
  );
  String? _error;
  bool _isScanning = false;

  void _handleScan(BarcodeCapture capture) {
    final String? code = capture.barcodes.first.rawValue;
    if (code != null) {
      _stopScanning();
      
      final encodedCode = Uri.encodeComponent(code);
      context.push('/register?sessionId=$encodedCode&method=qr');
    }
  }

  void _startScanning() {
    setState(() {
      _error = null;
      _isScanning = true;
    });
  }

  void _stopScanning() {
    if (mounted) {
      setState(() {
        _isScanning = false;
      });
    }
  }

  @override
  void dispose() {
    _scannerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgStart = isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE);
    final bgEnd = isDark ? const Color(0xFF1E293B) : const Color(0xFFF0FAFF);

    return Scaffold(
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowRight),
          onPressed: () => GoRouter.of(context).pop(),
          color: isDark ? Colors.white : Theme.of(context).colorScheme.primary,
        ),
        title: Text('مسح QR Code', style: GoogleFonts.tajawal(color: isDark ? Colors.white : Theme.of(context).colorScheme.primary)),
        centerTitle: true,
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
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
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Card(
              elevation: 4.0,
              color: isDark ? const Color(0xFF1E293B) : Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24.0),
                side: BorderSide(color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.transparent),
              ),
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  child: _isScanning ? _buildScannerUI(isDark) : _buildInitialUI(isDark),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInitialUI(bool isDark) {
    return Column(
      key: const ValueKey('initial'),
      children: [
        Container(
          width: 80,
          height: 80,
          decoration: BoxDecoration(
            color: isDark ? Colors.blue.withValues(alpha: 0.1) : Colors.blue.shade100,
            shape: BoxShape.circle,
          ),
          child: Icon(LucideIcons.camera, color: Theme.of(context).primaryColor, size: 40),
        ),
        const SizedBox(height: 16),
        Text('مسح QR Code', style: GoogleFonts.tajawal(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
        const SizedBox(height: 8),
        Text('وجه الكاميرا نحو رمز QR المعروض على السبورة', textAlign: TextAlign.center, style: GoogleFonts.tajawal(color: isDark ? Colors.white70 : Colors.grey.shade600, fontSize: 16)),
        const SizedBox(height: 24),
        if (_error != null) _buildErrorDisplay(),
        if (_error == null)
          ElevatedButton.icon(
            icon: const Icon(LucideIcons.camera, size: 20),
            label: Text('فتح الكاميرا', style: GoogleFonts.tajawal(fontWeight: FontWeight.bold)),
            onPressed: _startScanning,
            style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
          )
      ],
    );
  }

  Widget _buildErrorDisplay() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
              color: Colors.red.shade100,
              borderRadius: BorderRadius.circular(12)),
          child: Row(
            children: [
              Icon(LucideIcons.info, color: Colors.red.shade800),
              const SizedBox(width: 12),
              Expanded(child: Text(_error!, style: GoogleFonts.tajawal(color: Colors.red.shade900)))
            ],
          ),
        ),
        const SizedBox(height: 16),
        OutlinedButton.icon(
          onPressed: _startScanning,
          icon: const Icon(LucideIcons.refreshCw),
          label: Text('إعادة المحاولة', style: GoogleFonts.tajawal(fontWeight: FontWeight.bold)),
          style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: () => GoRouter.of(context).pushReplacement('/code-entry'),
          child: Text('استخدام إدخال الرمز بدلاً من ذلك', style: GoogleFonts.tajawal()),
        )
      ],
    );
  }

  Widget _buildScannerUI(bool isDark) {
    return Column(
      key: const ValueKey('scanner'),
      children: [
        SizedBox(
          width: 250,
          height: 250,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(16),
            child: MobileScanner(
              controller: _scannerController,
              onDetect: _handleScan,
              errorBuilder: (context, error) {
                 WidgetsBinding.instance.addPostFrameCallback((_) {
                    if (mounted) {
                      setState(() {
                        _isScanning = false;
                        _error = "فشل في تشغيل الكاميرا. تأكد من إعطاء الإذن.";
                      });
                    }
                 });
                return const Center(child: Icon(LucideIcons.videoOff, size: 48, color: Colors.grey));
              },
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text("جاري البحث عن رمز...", style: GoogleFonts.tajawal(color: isDark ? Colors.white70 : Colors.grey.shade600)),
        const SizedBox(height: 16),
        OutlinedButton(
          onPressed: _stopScanning,
          style: OutlinedButton.styleFrom(minimumSize: const Size(double.infinity, 50)),
          child: Text('إيقاف المسح', style: GoogleFonts.tajawal(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
