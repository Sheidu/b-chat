import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

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
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _error = data['error'] ?? 'Registration failed';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await http.post(
        Uri.parse('$baseUrl/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': email,
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
        _isLoading = false;
        notifyListeners();
        return true;
      } else {
        final data = jsonDecode(response.body);
        _error = data['error'] ?? 'Login failed';
      }
    } catch (e) {
      _error = 'Network error: $e';
    }

    _isLoading = false;
    notifyListeners();
    return false;
  }

  Future<bool> deleteMyAccount() async {
    if (_token == null) {
      _error = 'Unauthorized';
      notifyListeners();
      return false;
    }

    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/users/me'),
        headers: authJsonHeaders,
      );

      if (response.statusCode == 200) {
        logout();
        return true;
      }

      final data = jsonDecode(response.body);
      _error = data['error'] ?? 'Delete failed';
      notifyListeners();
      return false;
    } catch (e) {
      _error = 'Network error: $e';
      notifyListeners();
      return false;
    }
  }

  void logout() {
    _user = null;
    _token = null;
    notifyListeners();
  }
}
