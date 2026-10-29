import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// A key for storing the offline queue in shared preferences.
const String _offlineQueueKey = 'offline_attendance_queue';

// رمز مزامنة الطابور غير المتصل — مطابقة للرمز في Edge Function
// `sync-offline-attendance` (header x-queue-secret).
const String _queueSyncSecret = 'qhudoor-offline-sync-secret-2026';

// الحد الأقصى للسجلات في الدفعة الواحدة — نفس حد الخادم (50).
const int _maxBatchSize = 50;

/// سجل حضور محفوظ في الطابور غير المتصل.
///
/// يحمل كل الحقول التي يحتاجها الخادم لإعادة التحقّقات كاملة:
/// بيانات الجلسة + بيانات الطالب + بصمة الجهاز + الموقع + الوقت الأصلي.
class OfflineAttendanceRecord {
  final String sessionId;
  final String sessionCode;
  final String method; // 'qr' | 'code'
  final String qrData; // JSON للرمز السريع — للخادم للمطابقة
  final String studentNumber;
  final String firstName;
  final String lastName;
  final String deviceFingerprint;
  final String androidId;
  final double? latitude;
  final double? longitude;
  final DateTime timestamp;

  OfflineAttendanceRecord({
    required this.sessionId,
    required this.sessionCode,
    required this.method,
    required this.qrData,
    required this.studentNumber,
    required this.firstName,
    required this.lastName,
    required this.deviceFingerprint,
    String? androidId,
    this.latitude,
    this.longitude,
    required this.timestamp,
  }) : androidId = androidId ?? '';

  Map<String, dynamic> toJson() => {
    'sessionId': sessionId,
    'sessionCode': sessionCode,
    'method': method,
    'qrData': qrData,
    'studentNumber': studentNumber,
    'firstName': firstName,
    'lastName': lastName,
    'deviceFingerprint': deviceFingerprint,
    'androidId': androidId,
    'latitude': latitude,
    'longitude': longitude,
    'timestamp': timestamp.toIso8601String(),
  };

  factory OfflineAttendanceRecord.fromJson(Map<String, dynamic> json) => OfflineAttendanceRecord(
    sessionId: json['sessionId'],
    sessionCode: json['sessionCode'],
    method: json['method'],
    qrData: json['qrData'],
    studentNumber: json['studentNumber'],
    firstName: json['firstName'],
    lastName: json['lastName'],
    deviceFingerprint: json['deviceFingerprint'],
    androidId: json['androidId'],
    latitude: json['latitude'],
    longitude: json['longitude'],
    timestamp: DateTime.parse(json['timestamp']),
  );
}

class OfflineService {
  // Get the list of all offline records.
  Future<List<OfflineAttendanceRecord>> getOfflineRecords() async {
    final prefs = await SharedPreferences.getInstance();
    final List<String> queueJson = prefs.getStringList(_offlineQueueKey) ?? [];
    return queueJson
        .map((recordJson) => OfflineAttendanceRecord.fromJson(jsonDecode(recordJson)))
        .toList();
  }

  // Add a new record to the offline queue.
  Future<void> addRecordToOfflineQueue(OfflineAttendanceRecord record) async {
    final prefs = await SharedPreferences.getInstance();
    final List<String> queue = prefs.getStringList(_offlineQueueKey) ?? [];
    queue.add(jsonEncode(record.toJson()));
    await prefs.setStringList(_offlineQueueKey, queue);
  }

  // Get the number of pending records.
  Future<int> getOfflineQueueLength() async {
    final records = await getOfflineRecords();
    return records.length;
  }

  // Clear the entire offline queue.
  Future<void> clearOfflineQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_offlineQueueKey);
  }

  // مدة الاحتفاظ القصوى بالسجل (7 أيام). السجلات الأقدم تُحذف تلقائياً
  // لأن حضورها لم يعد صالحاً للإرسال.
  static const Duration maxRecordAge = Duration(days: 7);

  // حذف السجلات المنتهية الصلاحية من الطابور.
  Future<void> purgeExpiredRecords() async {
    final now = DateTime.now();
    final records = await getOfflineRecords();
    final valid = records.where((r) => now.difference(r.timestamp) <= maxRecordAge).toList();
    if (valid.length == records.length) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _offlineQueueKey,
      valid.map((r) => jsonEncode(r.toJson())).toList(),
    );
    debugPrint('Purged ${records.length - valid.length} expired offline record(s).');
  }

  /// رفع الدفعة إلى Edge Function `sync-offline-attendance`.
  ///
  /// الخادم يعيد حالة كل سجل على حدة (ok/skipped/error). السجلات التي
  /// قُبلت أو كان حضورها مسجلاً مسبقاً تُحذف من الطابور، والباقي يُعاد.
  ///
  /// أي استثناء (شبكة/خادم) يعني فشل الدفعة كاملة: يعاد كل شيء للطابور
  /// وتتعامل طبقة المزامنة مع إعادة المحاولة.
  Future<List<OfflineAttendanceRecord>> _pushRecords(
    List<OfflineAttendanceRecord> records,
  ) async {
    try {
      final payload = {
        'records': records
            .map((record) => <String, dynamic>{
              'sessionId': record.sessionId,
              'sessionCode': record.sessionCode,
              'method': record.method,
              'qrData': record.qrData.isNotEmpty ? record.qrData : null,
              'studentNumber': record.studentNumber,
              'firstName': record.firstName,
              'lastName': record.lastName,
              'deviceFingerprint': record.deviceFingerprint,
              if (record.androidId.isNotEmpty) 'androidId': record.androidId,
              if (record.latitude != null) 'latitude': record.latitude,
              if (record.longitude != null) 'longitude': record.longitude,
              'timestamp': record.timestamp.toIso8601String(),
            })
            .toList(),
      };

      final FunctionResponse response = await Supabase.instance.client.functions.invoke(
        'sync-offline-attendance',
        body: payload,
        headers: {'x-queue-secret': _queueSyncSecret},
      );

      final data = Map<String, dynamic>.from(response.data as Map);
      if (data['ok'] != true) {
        debugPrint('Sync function returned ok=false: ${data['error']}');
        return records;
      }

      final List<dynamic> results = List<dynamic>.from(data['results'] as List? ?? []);

      // مجموعة السجلات التي لم تُقبل (error فقط).
      final failedIndexes = results
          .where((r) => r is Map && r['status'] == 'error')
          .map((r) => (r as Map)['index'] as int?)
          .whereType<int>()
          .toSet();

      return records.whereIndexed((index, _) => failedIndexes.contains(index)).toList();
    } catch (error) {
      debugPrint('Sync failed for batch: $error');
      return records; // فشل الشبكة: الطابور يبقى كما هو لإعادة المحاولة.
    }
  }

  // المزامنة اليدوية (تُستدعى من المستخدم مباشرة).
  Future<void> manualSync() async {
    final records = await getOfflineRecords();
    if (records.isEmpty) {
      debugPrint('No offline records to sync.');
      return;
    }

    debugPrint('Attempting to sync ${records.length} records...');

    await purgeExpiredRecords();
    final afterPurge = await getOfflineRecords();
    final deduped = _deduplicate(afterPurge);

    final chunks = <List<OfflineAttendanceRecord>>[];
    for (int i = 0; i < deduped.length; i += _maxBatchSize) {
      chunks.add(deduped.sublist(i, i + _maxBatchSize > deduped.length ? deduped.length : i + _maxBatchSize));
    }

    final remaining = <OfflineAttendanceRecord>[];
    for (final chunk in chunks) {
      remaining.addAll(await _pushRecords(chunk));
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _offlineQueueKey,
      remaining.map((record) => jsonEncode(record.toJson())).toList(),
    );

    debugPrint('Sync complete. Sent: ${deduped.length - remaining.length}, pending: ${remaining.length}.');
  }

  // المزامنة التلقائية (تُستدعى من SyncOrchestrator عند عودة الاتصال).
  Future<void> autoSync() async {
    await purgeExpiredRecords();
    final records = await getOfflineRecords();
    if (records.isEmpty) return;

    final deduped = _deduplicate(records);
    debugPrint('Auto-syncing ${deduped.length} record(s)...');

    final chunks = <List<OfflineAttendanceRecord>>[];
    for (int i = 0; i < deduped.length; i += _maxBatchSize) {
      chunks.add(deduped.sublist(i, i + _maxBatchSize > deduped.length ? deduped.length : i + _maxBatchSize));
    }

    final remaining = <OfflineAttendanceRecord>[];
    for (final chunk in chunks) {
      remaining.addAll(await _pushRecords(chunk));
    }

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(
      _offlineQueueKey,
      remaining.map((record) => jsonEncode(record.toJson())).toList(),
    );

    debugPrint('Auto-sync complete. Sent: ${deduped.length - remaining.length}, pending: ${remaining.length}.');
  }

  // حذف التكرارات (نفس الجلسة + نفس الطالب) مع الإبقاء على الأحدث.
  List<OfflineAttendanceRecord> _deduplicate(List<OfflineAttendanceRecord> records) {
    final seen = <String, OfflineAttendanceRecord>{};
    for (final record in records) {
      final key = '${record.sessionId}:${record.studentNumber}';
      final existing = seen[key];
      if (existing == null || record.timestamp.isAfter(existing.timestamp)) {
        seen[key] = record;
      }
    }
    // المحافظة على ترتيب الإدراج الأصلي.
    return records.where((r) => seen['${r.sessionId}:${r.studentNumber}'] == r).toList();
  }
}

// ── تمديد Iterable.whereIndexed — غير متاح قبل Dart 3.5 ────────────────
extension WhereIndexed<T> on List<T> {
  List<T> whereIndexed(bool Function(int index, T element) test) {
    final result = <T>[];
    for (int i = 0; i < length; i++) {
      if (test(i, this[i])) result.add(this[i]);
    }
    return result;
  }
}
