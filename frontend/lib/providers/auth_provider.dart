import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AuthProvider with ChangeNotifier {
  Map<String, dynamic>? _user; // {id, email, name}
  String? _token;
  bool _isLoading = false;
  String? _error;

  Map<String, dynamic>? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isLoggedIn => _user != null && _token != null;

  String get baseUrl => AppConfig.baseUrl;

  static const _tokenKey = 'auth_token';
  static const _userKey = 'auth_user';

  AuthProvider() {
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString(_tokenKey);
    final userRaw = prefs.getString(_userKey);
    if (token == null || userRaw == null) return;
    try {
      final parsed = jsonDecode(userRaw);
      if (parsed is Map<String, dynamic>) {
        _token = token;
        _user = parsed;
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _persistSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (_token == null || _user == null) {
      await prefs.remove(_tokenKey);
      await prefs.remove(_userKey);
      return;
    }
    await prefs.setString(_tokenKey, _token!);
    await prefs.setString(_userKey, jsonEncode(_user));
  }

  Future<void> handleUnauthorized({String message = 'loginFailed'}) async {
    _error = message;
    await logout();
  }


  Map<String, String> get authJsonHeaders => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Future<bool> register(
    String email,
    String phoneNumber,
    String password,
    String name, {
    required bool termsAccepted,
    required String consentText,
    String authChannel = 'email',
    String locale = 'ru',
  }) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/register'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
          'phoneNumber': phoneNumber,
          'password': password,
          'name': name.isEmpty ? null : name,
          'termsAccepted': termsAccepted,
          'consentText': consentText,
          'authChannel': authChannel,
          'locale': locale,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        _token = data['token'] as String?;
        _user = {
          'id': data['id'],
          'email': data['email'],
          'phoneNumber': data['phoneNumber'],
          'name': data['name'],
          'authChannel': data['authChannel'],
        };
        await _persistSession();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _error = data['error'] ?? 'registrationFailed';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> login(String identifier, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'identifier': identifier,
          'password': password,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        _token = data['token'] as String?;
        _user = {
          'id': data['id'],
          'email': data['email'],
          'phoneNumber': data['phoneNumber'],
          'name': data['name'],
          'authChannel': data['authChannel'],
        };
        await _persistSession();
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _error = data['error'] ?? 'loginFailed';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }


  Future<bool> updateProfile({required String email, required String phoneNumber, required String name}) async {
    if (_token == null) {
      _error = 'loginFailed';
      notifyListeners();
      return false;
    }

    try {
      final response = await http.patch(
        Uri.parse('$baseUrl/users/me'),
        headers: authJsonHeaders,
        body: jsonEncode({'email': email, 'phoneNumber': phoneNumber, 'name': name}),
      );
      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        _user = data['user'] as Map<String, dynamic>;
        final nextToken = data['token'];
        if (nextToken is String && nextToken.isNotEmpty) {
          _token = nextToken;
        }
        await _persistSession();
        notifyListeners();
        return true;
      }
      if (response.statusCode == 401) {
        await handleUnauthorized();
        return false;
      }
      _error = data['error'] ?? 'profileUpdateFailed';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error: $e';
      notifyListeners();
      return false;
    }
  }

  Future<bool> deleteMyAccount() async {
    if (_token == null) {
      _error = 'loginFailed';
      notifyListeners();
      return false;
    }

    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/users/me'),
        headers: authJsonHeaders,
      );

      if (response.statusCode == 200) {
        await logout();
        return true;
      }
      if (response.statusCode == 401) {
        await handleUnauthorized();
        return false;
      }

      final data = jsonDecode(response.body);
      _error = data['error'] ?? 'profileUpdateFailed';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error: $e';
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _user = null;
    _token = null;
    await _persistSession();
    notifyListeners();
  }
}
