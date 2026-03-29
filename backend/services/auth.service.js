const bcrypt = require('bcrypt');

function buildAuthService({ usersRepository, bcryptSaltRounds, onUserRegistered }) {
  function register({ email, password, name }) {
    if (!email || !password) {
      return { status: 400, body: { error: 'Email and password required' } };
    }

    const existing = usersRepository.findUserIdByEmail(email);
    if (existing) {
      return { status: 400, body: { error: 'Email already taken' } };
    }

    const resolvedName = name || email.split('@')[0];
    const passwordHash = bcrypt.hashSync(password, bcryptSaltRounds);
    const info = usersRepository.createUser(email, passwordHash, resolvedName);
    const user = { id: info.lastInsertRowid, email, name: resolvedName };

    if (typeof onUserRegistered === 'function') {
      onUserRegistered(user);
    }

    return { status: 200, body: user };
  }

  function login({ email, password }) {
    const normalizedEmail = typeof email === 'string' ? email.trim() : '';
    const normalizedPassword = typeof password === 'string' ? password : '';

    if (!normalizedEmail || !normalizedPassword) {
      return { status: 400, body: { error: 'Email and password required' } };
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
      return { status: 401, body: { error: 'Invalid email or password' } };
    }

    return {
      status: 200,
      body: { id: user.id, email: user.email, name: user.name },
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
