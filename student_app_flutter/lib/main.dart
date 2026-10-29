import 'package:flutter/material.dart';
import 'package:student_app_flutter/services/connectivity_service.dart';
import 'package:student_app_flutter/services/sync_orchestrator.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:student_app_flutter/features/student_home/student_page.dart';
import 'package:student_app_flutter/features/scan/student_scan_page.dart';
import 'package:student_app_flutter/features/qr_scanner/student_qr_scanner_page.dart';
import 'package:student_app_flutter/features/code_entry/student_code_entry_page.dart';
import 'package:student_app_flutter/features/registration/registration_page.dart';
import 'package:student_app_flutter/features/onboarding/onboarding_page.dart';
import 'package:supabase_flutter/supabase_flutter.dart';


// --- Main App Setup ---
// --- الإعداد الرئيسي للتطبيق ---

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode = ThemeMode.light;
  ThemeMode get themeMode => _themeMode;

  void toggleTheme() {
    _themeMode = _themeMode == ThemeMode.light ? ThemeMode.dark : ThemeMode.light;
    notifyListeners();
  }
}

final themeProvider = ThemeProvider();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize connectivity monitoring and the automatic sync orchestrator.
  await connectivityService.initialize();
  syncOrchestrator.start();

  // Read Supabase config from compile-time defines.
  // Fallback to runtime defaults so the app does NOT silently hang on splash
  // if someone forgets to pass --dart-define during the build.
  const supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://xdstewrosxrenrfrwprv.supabase.co',
  );
  const supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhkc3Rld3Jvc3hyZW5yZnJ3cHJ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNTIwNDksImV4cCI6MjA5MTkyODA0OX0.nhf02WCpaVZfbRTx9eNqn5ZuWMcRQyEd2E1ymklcI-k',
  );

  String? initError;
  try {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
    );
  } catch (e) {
    initError = e.toString();
  }

  runApp(
    ListenableBuilder(
      listenable: themeProvider,
      builder: (context, child) {
        if (initError != null) return _BootError(message: initError!);
        // Use a key tied to theme mode so MaterialApp.router fully reconciles
        // its theme on toggle (avoids stale Theme.of(context) inside pages).
        return MyApp(key: ValueKey(themeProvider.themeMode));
      },
    ),
  );
}

/// شاشة احتياطية تظهر بدل splash لانهائي عند فشل التهيئة.
class _BootError extends StatelessWidget {
  final String message;
  const _BootError({required this.message});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, color: Colors.redAccent, size: 64),
                const SizedBox(height: 16),
                const Text(
                  'تعذر بدء التطبيق',
                  style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                const Text(
                  'فشل في الاتصال بالخادم. تأكد من الاتصال بالإنترنت ثم أعد المحاولة.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.05),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    message,
                    style: const TextStyle(color: Colors.white38, fontSize: 11, fontFamily: 'monospace'),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Ausar Military',
      theme: _buildTheme(Brightness.light),
      darkTheme: _buildTheme(Brightness.dark),
      themeMode: themeProvider.themeMode,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}

// --- Navigation ---
// --- نظام التنقل بين الصفحات ---
final _router = GoRouter(
  initialLocation: '/launch',
  routes: [
    GoRoute(
      path: '/launch',
      builder: (context, state) => const _LaunchGate(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnboardingPage(),
    ),
    GoRoute(
      path: '/',
      builder: (context, state) => const StudentPage(),
    ),
    GoRoute(
      path: '/scan',
      builder: (context, state) => const StudentScanPage(),
    ),
    GoRoute(
      path: '/qr-scanner',
      builder: (context, state) => const StudentQRScannerPage(),
    ),
    GoRoute(
      path: '/code-entry',
      builder: (context, state) => const StudentCodeEntryPage(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) {
        final sessionId = state.uri.queryParameters['sessionId']!;
        final method = state.uri.queryParameters['method']!;
        return RegistrationPage(sessionId: sessionId, method: method);
      },
    ),
  ],
);

/// يقرر عند فتح التطبيق: هل نعرض onboarding (أول مرة) أم نذهب للرئيسية مباشرة.
class _LaunchGate extends StatefulWidget {
  const _LaunchGate();

  @override
  State<_LaunchGate> createState() => _LaunchGateState();
}

class _LaunchGateState extends State<_LaunchGate> {
  @override
  void initState() {
    super.initState();
    _decide();
  }

  Future<void> _decide() async {
    final showOnboarding = await shouldShowOnboarding();
    if (!mounted) return;
    if (showOnboarding) {
      context.go('/onboarding');
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFE0F2FE),
      body: const Center(
        child: CircularProgressIndicator(color: Color(0xFF2563EB)),
      ),
    );
  }
}

// --- Theme ---
// --- تصميم وألوان التطبيق ---
ThemeData _buildTheme(Brightness brightness) {
  final isDark = brightness == Brightness.dark;
  
  const primaryColor = Color(0xFF2563EB); // blue-600
  const secondaryColor = Color(0xFF0891B2); // cyan-600
  
  final backgroundColor = isDark ? const Color(0xFF0F172A) : const Color(0xFFF0F9FF);
  final surfaceColor = isDark ? const Color(0xFF1E293B) : Colors.white;

  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    fontFamily: GoogleFonts.tajawal().fontFamily,
    scaffoldBackgroundColor: backgroundColor,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      primary: primaryColor,
      secondary: secondaryColor,
      surface: surfaceColor,
      brightness: brightness,
    ),
    cardTheme: CardThemeData(
      color: surfaceColor,
      elevation: isDark ? 0 : 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: isDark 
          ? BorderSide(color: Colors.white.withValues(alpha: 0.1), width: 1)
          : BorderSide(color: Colors.grey.withValues(alpha: 0.1), width: 1),
      ),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      elevation: 0,
      iconTheme: IconThemeData(color: isDark ? Colors.white : primaryColor),
      titleTextStyle: GoogleFonts.tajawal(
        color: isDark ? Colors.white : primaryColor,
        fontSize: 20,
        fontWeight: FontWeight.bold,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: primaryColor,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12), // --radius in CSS
        ),
      ),
    ),
  );
}
