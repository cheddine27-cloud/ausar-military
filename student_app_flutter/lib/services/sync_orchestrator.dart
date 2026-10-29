import 'dart:async';

import 'package:flutter/foundation.dart';

import 'connectivity_service.dart';
import 'offline_service.dart';

/// منسّق المزامنة التلقائية — SyncOrchestrator
///
/// يستمع لتغيّرات حالة الاتصال عبر [connectivityService]، وعند عودة الاتصال
/// يُشغّل مزامنة تلقائية لسجلات الطابور غير المتصل، مع:
/// - قفل mutex يضمن عدم تشغيل مزامنتين متزامنتين.
/// - Backoff متدرج (30s → 60s → 120s) بحد أقصى 3 محاولات إذا ظلّ الإرسال يفشل.
/// - تنبيه واحد عند اكتمال المزامنة الناجحة (أو عند فشل جميع المحاولات).
class SyncOrchestrator {
  static final SyncOrchestrator _instance = SyncOrchestrator._internal();
  factory SyncOrchestrator() => _instance;
  SyncOrchestrator._internal();

  final OfflineService _offline = OfflineService();

  StreamSubscription<ConnectivityStatus>? _subscription;
  bool _syncInProgress = false;
  int _retryAttempt = 0;
  static const int _maxRetryAttempts = 3;

  // فترات إعادة المحاولة بالثواني (backoff متدرج).
  static const List<Duration> _retryDelays = [
    Duration(seconds: 30),
    Duration(seconds: 60),
    Duration(seconds: 120),
  ];

  Timer? _retryTimer;
  int _syncedCount = 0;

  /// يبدأ مراقبة حالة الاتصال. يُستدعى مرة واحدة في [main].
  void start() {
    // تجنّب الاشتراك المزدوج.
    if (_subscription != null) return;

    _subscription = connectivityService.statusStream.listen(
      _handleConnectivityChange,
      onError: (Object error) {
        // أي خطأ في البث لا يُسقط التطبيق — فقط نسجّل.
        debugPrint('[SyncOrchestrator] stream error: $error');
      },
    );
    debugPrint('[SyncOrchestrator] started listening to connectivity changes.');

    // محاولة مزامنة أولية عند بدء التطبيق إذا كان الجهاز متصلاً.
    if (connectivityService.currentStatus == ConnectivityStatus.online) {
      _tryAutoSync();
    }
  }

  void _handleConnectivityChange(ConnectivityStatus status) {
    if (status == ConnectivityStatus.online) {
      debugPrint('[SyncOrchestrator] back online — auto sync triggered.');
      _retryTimer?.cancel();
      _retryTimer = null;
      _retryAttempt = 0;
      _syncedCount = 0;
      _tryAutoSync();
    } else {
      debugPrint('[SyncOrchestrator] went offline — pending records will auto-sync later.');
    }
  }

  /// يحاول المزامنة التلقائية مع قفل ضد التكرار المتزامن.
  Future<void> _tryAutoSync() async {
    if (_syncInProgress) {
      debugPrint('[SyncOrchestrator] sync already in progress, skipping.');
      return;
    }

    _syncInProgress = true;
    try {
      final length = await _offline.getOfflineQueueLength();
      if (length == 0) {
        debugPrint('[SyncOrchestrator] queue is empty, nothing to sync.');
        return;
      }

      debugPrint('[SyncOrchestrator] auto-syncing $length pending record(s)...');
      await _offline.autoSync();

      final newLength = await _offline.getOfflineQueueLength();
      final sentThisRun = length - newLength;
      if (sentThisRun > 0) {
        _syncedCount += sentThisRun;
        debugPrint('[SyncOrchestrator] synced $sentThisRun record(s) this run ($_syncedCount total).');
      }

      if (newLength == 0) {
        debugPrint('[SyncOrchestrator] all records synced ($_syncedCount sent).');
        _retryAttempt = 0;
        _retryTimer?.cancel();
        _retryTimer = null;
      } else if (_retryAttempt < _maxRetryAttempts) {
        // الاتصال ما زال غير صالح فعليّاً — إعادة المحاولة بعد backoff.
        final delay = _retryDelays[_retryAttempt.clamp(0, _retryDelays.length - 1)];
        debugPrint('[SyncOrchestrator] retrying in ${delay.inSeconds}s '
            '(attempt ${_retryAttempt + 1}/$_maxRetryAttempts)...');
        _retryAttempt += 1;
        _retryTimer?.cancel();
        _retryTimer = Timer(delay, () {
          if (connectivityService.currentStatus == ConnectivityStatus.online) {
            _tryAutoSync();
          } else {
            debugPrint('[SyncOrchestrator] still offline when retry fired — will sync on reconnect.');
          }
        });
      } else {
        debugPrint('[SyncOrchestrator] max retries reached; records stay queued '
            'and will sync on next reconnect or manual sync.');
        _retryAttempt = 0;
        _retryTimer?.cancel();
        _retryTimer = null;
      }
    } catch (error, stack) {
      debugPrint('[SyncOrchestrator] unexpected error during auto-sync: $error\n$stack');
    } finally {
      _syncInProgress = false;
    }
  }

  void dispose() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _subscription?.cancel();
    _subscription = null;
  }
}

// نسخة عامة للاستخدام في [main].
final syncOrchestrator = SyncOrchestrator();
