const bcrypt = require('bcrypt');

const SUPPORTED_AUTH_CHANNELS = new Set(['email', 'phone_ru', 'esia', 'biometric']);

function parseEmailDomain(email) {
  const atIndex = email.lastIndexOf('@');
  if (atIndex < 0 || atIndex === email.length - 1) return '';
  return email.slice(atIndex + 1).toLowerCase();
}

function isRuEmailDomain(domain) {
  return domain.endsWith('.ru') || domain.endsWith('.рф');
}

function buildAuthService({
  usersRepository,
  complianceRepository,
  bcryptSaltRounds,
  onUserRegistered,
  registrationPolicy,
  defaultTermsVersion,
}) {
  const resolvedPolicy = registrationPolicy || 'strict_ru_email';
  const termsVersion = defaultTermsVersion || '2026-03-31';

  function logComplianceEvent(payload) {
    if (!complianceRepository || typeof complianceRepository.createEvent !== 'function') return;
    complianceRepository.createEvent(payload);
  }

  function validateRegistrationPolicy({ email, authChannel }) {
    if (!SUPPORTED_AUTH_CHANNELS.has(authChannel)) {
      return 'Unsupported auth channel';
    }

    if (resolvedPolicy !== 'strict_ru_email') {
      return null;
    }

    if (authChannel !== 'email') {
      return 'Only email channel is currently available';
    }

    const domain = parseEmailDomain(email);
    if (!isRuEmailDomain(domain)) {
      return 'Only .ru/.рф email domains are allowed by current policy';
    }

    return null;
  }

  function register({ email, password, name, termsAccepted, authChannel = 'email', context = {} }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      return { status: 400, body: { error: 'Email and password required' } };
    }

    if (termsAccepted !== true) {
      logComplianceEvent({
        eventType: 'register',
        status: 'rejected',
        email: normalizedEmail,
        authChannel,
        reason: 'terms_not_accepted',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return { status: 400, body: { error: 'User agreement acceptance is required' } };
    }

    const policyError = validateRegistrationPolicy({ email: normalizedEmail, authChannel });
    if (policyError) {
      logComplianceEvent({
        eventType: 'register',
        status: 'rejected',
        email: normalizedEmail,
        authChannel,
        reason: policyError,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return { status: 400, body: { error: policyError } };
    }

    const existing = usersRepository.findUserIdByEmail(normalizedEmail);
    if (existing) {
      return { status: 400, body: { error: 'Email already taken' } };
    }

    const resolvedName = name || normalizedEmail.split('@')[0];
    const passwordHash = bcrypt.hashSync(password, bcryptSaltRounds);
    const acceptedAt = new Date().toISOString();
    const info = usersRepository.createUser(
      normalizedEmail,
      passwordHash,
      resolvedName,
      authChannel,
      termsVersion,
      acceptedAt
    );
    const user = {
      id: info.lastInsertRowid,
      email: normalizedEmail,
      name: resolvedName,
      authChannel,
      termsVersion,
      termsAcceptedAt: acceptedAt,
    };

    logComplianceEvent({
      eventType: 'register',
      status: 'accepted',
      userId: user.id,
      email: user.email,
      authChannel,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    if (typeof onUserRegistered === 'function') {
      onUserRegistered(user);
    }

    return { status: 200, body: user };
  }

  function login({ email, password, context = {} }) {
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !normalizedPassword) {
      return { status: 400, body: { error: 'Email and password required' } };
    }

    if (resolvedPolicy === 'strict_ru_email') {
      const domain = parseEmailDomain(normalizedEmail);
      if (!isRuEmailDomain(domain)) {
        logComplianceEvent({
          eventType: 'login',
          status: 'rejected',
          email: normalizedEmail,
          authChannel: 'email',
          reason: 'disallowed_email_domain',
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });
        return { status: 400, body: { error: 'Email domain is not allowed by current policy' } };
      }
    }

    const user = usersRepository.findUserByEmail(normalizedEmail);
    if (!user) {
      return { status: 401, body: { error: 'Invalid email or password' } };
    }

    const storedPassword = user.password || '';
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(storedPassword);
    let isValidPassword = false;

    if (looksHashed) {
      isValidPassword = bcrypt.compareSync(normalizedPassword, storedPassword);
    } else {
      isValidPassword = storedPassword === normalizedPassword;
      if (isValidPassword) {
        const upgradedHash = bcrypt.hashSync(normalizedPassword, bcryptSaltRounds);
        usersRepository.upgradePasswordHash(user.id, upgradedHash);
      }
    }

    if (!isValidPassword) {
      logComplianceEvent({
        eventType: 'login',
        status: 'rejected',
        userId: user.id,
        email: user.email,
        authChannel: user.auth_channel || 'email',
        reason: 'invalid_credentials',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return { status: 401, body: { error: 'Invalid email or password' } };
    }

    logComplianceEvent({
      eventType: 'login',
      status: 'accepted',
      userId: user.id,
      email: user.email,
      authChannel: user.auth_channel || 'email',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return {
      status: 200,
      body: {
        id: user.id,
        email: user.email,
        name: user.name,
        authChannel: user.auth_channel || 'email',
      },
    };
  }

  return {
    register,
    login,
  };
}

module.exports = {
  buildAuthService,
};
