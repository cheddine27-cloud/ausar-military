import 'dart:async';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart';

enum ConnectivityStatus { online, offline }

class ConnectivityService {
  // Create a singleton instance
  static final ConnectivityService _instance = ConnectivityService._internal();
  factory ConnectivityService() => _instance;
  ConnectivityService._internal();

  final Connectivity _connectivity = Connectivity();
  
  // Controller for the status stream
  final StreamController<ConnectivityStatus> _statusController = StreamController<ConnectivityStatus>.broadcast();

  Stream<ConnectivityStatus> get statusStream => _statusController.stream;

  ConnectivityStatus _currentStatus = ConnectivityStatus.online;
  ConnectivityStatus get currentStatus => _currentStatus;

  Future<void> initialize() async {
    // Initial check
    final List<ConnectivityResult> results = await _connectivity.checkConnectivity();
    _updateStatus(results);

    // Listen to changes
    _connectivity.onConnectivityChanged.listen((List<ConnectivityResult> results) {
      _updateStatus(results);
    });
  }

  void _updateStatus(List<ConnectivityResult> results) {
    // connectivity_plus 6.x returns a list of results. 
    // If it contains 'none', we are offline.
    final bool isOffline = results.contains(ConnectivityResult.none);
    final status = isOffline ? ConnectivityStatus.offline : ConnectivityStatus.online;
    
    if (_currentStatus != status) {
      _currentStatus = status;
      _statusController.add(status);
      debugPrint('Connectivity Status Changed: $status');
    }
  }

  void dispose() {
    _statusController.close();
  }
}

// Global instance for convenience
final connectivityService = ConnectivityService();
