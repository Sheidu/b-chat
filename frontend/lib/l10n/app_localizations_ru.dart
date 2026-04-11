// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for Russian (`ru`).
class AppLocalizationsRu extends AppLocalizations {
  AppLocalizationsRu([String locale = 'ru']) : super(locale);

  @override
  String get appName => 'Семейный чат';

  @override
  String get loginTitle => 'Войдите, чтобы продолжить';

  @override
  String get loginButton => 'Войти';

  @override
  String get registerTitle => 'Создать аккаунт';

  @override
  String get registerHeader => 'Присоединяйтесь к семье';

  @override
  String get registerButton => 'Создать аккаунт';

  @override
  String get emailLabel => 'Электронная почта';

  @override
  String get emailHint => 'Электронная почта';

  @override
  String get emailRequired => 'Введите адрес электронной почты';

  @override
  String get emailInvalid => 'Введите корректный адрес электронной почты';

  @override
  String get emailRuHint => 'Для пользователей из РФ: требуются домены .ru или .рф';

  @override
  String get passwordLabel => 'Пароль';

  @override
  String get passwordHint => 'Пароль';

  @override
  String get passwordRequired => 'Введите пароль';

  @override
  String get passwordMinLength => 'Пароль должен содержать не менее 4 символов';

  @override
  String get passwordTooShort => 'Пароль слишком короткий (мин. 4 символа)';

  @override
  String get nameLabel => 'Имя (необязательно)';

  @override
  String get termsCheckboxLabel => 'Я принимаю Пользовательское соглашение';

  @override
  String get termsCheckboxSubtitle => 'Требуется для регистрации аккаунта';

  @override
  String termsProcessingConsent(String ownerName) {
    return 'Я понимаю, что это семейный чат. Мои сообщения хранятся на сервере $ownerName. Я согласен на такую обработку в семейных целях.';
  }

  @override
  String get termsRequired => 'Необходимо принять Пользовательское соглашение';

  @override
  String get termsViewLink => 'Читать полное Пользовательское соглашение →';

  @override
  String termsUrlDisplay(String agreementUrl) {
    return '🔗 $agreementUrl';
  }

  @override
  String get loginFailed => 'Неверный email или пароль';

  @override
  String get registrationFailed => 'Ошибка регистрации';

  @override
  String get registrationSuccess => 'Аккаунт создан! Пожалуйста, войдите';

  @override
  String get noAccountPrompt => 'Нет аккаунта? Зарегистрироваться';

  @override
  String get hasAccountPrompt => 'Уже есть аккаунт? Войти';

  @override
  String homeTitle(String name) {
    return 'Семья – $name';
  }

  @override
  String get logoutButton => 'Выйти';

  @override
  String get loadingUsers => 'Загрузка контактов...';

  @override
  String get loadUsersError => 'Не удалось загрузить пользователей';

  @override
  String networkError(String error) {
    return 'Ошибка сети: $error';
  }

  @override
  String get noUsersMessage => 'Пока нет участников семьи. Пригласите кого-нибудь, чтобы начать чат!';

  @override
  String get retryButton => 'Повторить';

  @override
  String chatTitle(String userName) {
    return 'Чат с $userName';
  }

  @override
  String get loadingMessages => 'Загрузка сообщений...';

  @override
  String get chatHint => 'Введите сообщение...';

  @override
  String get sendMessage => 'Отправить сообщение';

  @override
  String get messageSendFailed => 'Не удалось отправить. Проверьте соединение.';

  @override
  String get connectionLost => 'Соединение потеряно. Повторное подключение...';

  @override
  String get noMessages => 'Сообщений пока нет. Начните разговор!';

  @override
  String get connectionStatusConnected => 'Подключено';

  @override
  String get connectionStatusConnecting => 'Подключение...';

  @override
  String get connectionStatusDisconnected => 'Отключено';

  @override
  String get connectionStatusError => 'Ошибка соединения';

  @override
  String get genericError => 'Произошла непредвиденная ошибка';

  @override
  String get complianceFooter => 'Регистрация соответствует Федеральному закону № 406-ФЗ';

  @override
  String get cannotOpenLink => 'Не удалось открыть ссылку. Скопируйте URL вручную.';

  @override
  String get emailDomainNotAllowed => 'Домен электронной почты не разрешён для регистрации';

  @override
  String get settingsTitle => 'Настройки';

  @override
  String get languageLabel => 'Язык';

  @override
  String get languageSubtitle => 'Выберите предпочтительный язык';

  @override
  String get languageDefaultHint => '(По умолчанию для соответствия требованиям)';

  @override
  String get accountLabel => 'Аккаунт';

  @override
  String get complianceInfoTitle => 'Информация о соответствии';

  @override
  String appVersion(String version) {
    return 'Версия $version';
  }

  @override
  String get languageEnglish => 'English';

  @override
  String get languageRussian => 'Русский';
}
