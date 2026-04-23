import '../l10n/app_localizations.dart';

/// Formats an error string for display using localized messages.
/// 
/// The [error] parameter should be either:
/// - `null` - returns the [fallbackMessage]
/// - A string starting with 'networkError:' - extracts the error details and returns [l10n.networkError(details)]
/// - Any other string - returns the [fallbackMessage]
String formatErrorMessage(String? error, AppLocalizations l10n, String fallbackMessage) {
  if (error == null) return fallbackMessage;
  
  if (error.startsWith('networkError:')) {
    final errorDetails = error.substring('networkError:'.length);
    return l10n.networkError(errorDetails);
  }
  
  return fallbackMessage;
}
