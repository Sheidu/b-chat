const bcrypt = require('bcrypt');
const crypto = require('crypto');

const SUPPORTED_AUTH_CHANNELS = new Set(['email']);

function parseEmailDomain(email) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0 || atIndex === email.length - 1) return '';
  return email.slice(atIndex + 1).toLowerCase();
}

function isRuEmailDomain(domain) {
  return domain.endsWith('.ru') || domain.endsWith('.рф');
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function normalizePhoneNumber(value, policy = "strict_ru_email") {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 11 && digits.startsWith('7')) {
    return `+${digits}`;
  }
  if (policy === "open_email") {
    if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  }
  return null;
}

function resolveRegistrationPolicy(policy) {
  if (policy === 'open_email' || policy === 'strict_ru_email') {
    return policy;
  }
  return 'strict_ru_email';
}

function timingSafeLoginError() {
  return { status: 401, body: { error: 'Invalid credentials' } };
}

function buildAuthService({
  usersRepository,
  complianceRepository,
  jwtAuthService,
  bcryptSaltRounds,
  onUserRegistered,
  registrationPolicy,
  defaultTermsVersion,
  userAgreementUrl,
  notificationService,
}) {
  const resolvedPolicy = resolveRegistrationPolicy(registrationPolicy);
  const termsVersion = defaultTermsVersion || '2026-03-31';
  const resolvedUserAgreementUrl = userAgreementUrl || '';

  function logComplianceEvent(payload) {
    if (!complianceRepository || typeof complianceRepository.createEvent !== 'function') return;
    complianceRepository.createEvent(payload);
  }

  function withToken(user) {
    if (!jwtAuthService || typeof jwtAuthService.issueToken !== 'function') {
      return user;
    }

    return {
      ...user,
      token: jwtAuthService.issueToken(user),
    };
  }

  function validateRegistrationPolicy({ email, authChannel }) {
    if (!SUPPORTED_AUTH_CHANNELS.has(authChannel)) {
      return 'Unsupported auth channel';
    }

    if (resolvedPolicy === 'open_email') {
      return null;
    }

    const domain = parseEmailDomain(email);
    if (!isRuEmailDomain(domain)) {
      return 'Only .ru/.рф email domains are allowed by current policy';
    }

    return null;
  }

  function register({ email, password, phoneNumber, name, termsAccepted, consentText, authChannel = 'email', locale = 'ru', context = {} }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!normalizedEmail || !password) {
      return { status: 400, body: { error: 'Email and password required' } };
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber, resolvedPolicy);
    if (!normalizedPhoneNumber) {
      return { status: 400, body: { error: 'Valid RU phone number is required (+7XXXXXXXXXX or 8XXXXXXXXXX)' } };
    }

    if (!isValidEmail(normalizedEmail)) {
      return { status: 400, body: { error: 'Invalid email format' } };
    }
    if (termsAccepted !== true) {
      logComplianceEvent({ eventType: 'register', status: 'rejected', email: normalizedEmail, phone: normalizedPhoneNumber, authChannel, reason: 'terms_not_accepted', ipAddress: context.ipAddress, userAgent: context.userAgent });
      return { status: 400, body: { error: 'User agreement acceptance is required' } };
    }

    const normalizedConsentText = typeof consentText === 'string' ? consentText.trim() : '';
    if (!normalizedConsentText) return { status: 400, body: { error: 'Consent text is required' } };

    const policyError = validateRegistrationPolicy({ email: normalizedEmail, authChannel });
    if (policyError) {
      logComplianceEvent({ eventType: 'register', status: 'rejected', email: normalizedEmail, phone: normalizedPhoneNumber, authChannel, reason: policyError, ipAddress: context.ipAddress, userAgent: context.userAgent });
      return { status: 400, body: { error: policyError } };
    }

    const existing = usersRepository.findUserByEmailOrPhone(normalizedEmail, normalizedPhoneNumber);
    if (existing) {
      return { status: 400, body: { error: 'Email or phone already taken' } };
    }

    const resolvedName = name || normalizedEmail.split('@')[0];
    const passwordHash = bcrypt.hashSync(password, bcryptSaltRounds);
    const acceptedAt = new Date().toISOString();
    const termsEvidenceHash = crypto.createHash('sha256').update(`${termsVersion}|${resolvedUserAgreementUrl}|${normalizedConsentText}`).digest('hex');

    const info = usersRepository.createUser(normalizedEmail, normalizedPhoneNumber, passwordHash, resolvedName, authChannel, termsVersion, acceptedAt, resolvedUserAgreementUrl, termsEvidenceHash);

    const user = { id: info.lastInsertRowid, email: normalizedEmail, phoneNumber: normalizedPhoneNumber, name: resolvedName, authChannel, termsVersion, termsAcceptedAt: acceptedAt, termsUrl: resolvedUserAgreementUrl || null };

    logComplianceEvent({ eventType: 'register', status: 'accepted', userId: user.id, email: user.email, phone: user.phoneNumber, authChannel, reason: `terms_hash:${termsEvidenceHash}`, ipAddress: context.ipAddress, userAgent: context.userAgent });
    if (typeof onUserRegistered === 'function') onUserRegistered(user);
    if (notificationService && typeof notificationService.enqueueWelcomeEmail === 'function') {
      notificationService.enqueueWelcomeEmail({ email: user.email, phoneNumber: user.phoneNumber, name: user.name, locale });
    }

    return { status: 200, body: withToken(user) };
  }

  function login({ identifier, email, password, context = {} }) {
    const rawIdentifier = typeof identifier === 'string' && identifier.trim() ? identifier : email;
    const normalizedIdentifier = typeof rawIdentifier === 'string' ? rawIdentifier.trim().toLowerCase() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    if (!normalizedIdentifier || !normalizedPassword) return timingSafeLoginError();

    const isEmailLogin = normalizedIdentifier.includes('@');
    const normalizedPhone = isEmailLogin ? null : normalizePhoneNumber(normalizedIdentifier, resolvedPolicy);
    const normalizedEmail = isEmailLogin ? normalizedIdentifier : null;

    if (isEmailLogin && !isValidEmail(normalizedEmail)) return timingSafeLoginError();
    if (!isEmailLogin && !normalizedPhone) return timingSafeLoginError();

    if (isEmailLogin && resolvedPolicy !== 'open_email') {
      const domain = parseEmailDomain(normalizedEmail);
      if (!isRuEmailDomain(domain)) {
        logComplianceEvent({ eventType: 'login', status: 'rejected', email: normalizedEmail, authChannel: 'email', reason: 'disallowed_email_domain', ipAddress: context.ipAddress, userAgent: context.userAgent });
        return timingSafeLoginError();
      }
    }

    const user = isEmailLogin ? usersRepository.findUserByEmail(normalizedEmail) : usersRepository.findUserByPhone(normalizedPhone);
    if (!user || user.deleted_at) return timingSafeLoginError();

    const storedPassword = user.password || '';
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
    let isValidPassword = false;

    if (looksHashed) {
      isValidPassword = bcrypt.compareSync(normalizedPassword, storedPassword);
    } else {
      isValidPassword = storedPassword === normalizedPassword;
      if (isValidPassword) usersRepository.upgradePasswordHash(user.id, bcrypt.hashSync(normalizedPassword, bcryptSaltRounds));
    }

    if (!isValidPassword) {
      logComplianceEvent({ eventType: 'login', status: 'rejected', userId: user.id, email: user.email, authChannel: user.auth_channel || 'email', reason: 'invalid_credentials', ipAddress: context.ipAddress, userAgent: context.userAgent });
      return timingSafeLoginError();
    }

    logComplianceEvent({ eventType: 'login', status: 'accepted', userId: user.id, email: user.email, phone: user.phone_number || null, authChannel: user.auth_channel || 'email', ipAddress: context.ipAddress, userAgent: context.userAgent });

    return { status: 200, body: withToken({ id: user.id, email: user.email, phoneNumber: user.phone_number || null, name: user.name, authChannel: user.auth_channel || 'email' }) };
  }

  return { register, login, normalizePhoneNumber };
}

module.exports = { buildAuthService, normalizePhoneNumber };
