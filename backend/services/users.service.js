function parsePositiveInt(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeOptionalNickname(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > 80) return null;
  return trimmed;
}


function normalizePhoneNumber(value) {
  if (typeof value !== 'string') return null;
  const digits = value.trim().replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) return `+7${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith('7')) return `+${digits}`;
  return null;
}

function isValidEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function buildUsersService({ usersRepository, complianceRepository, hardDeleteUsers = false, jwtAuthService }) {
  function listUsers(authUserId) {
    if (!authUserId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    return { status: 200, body: usersRepository.listContactsForUser(authUserId) };
  }

  function discoverUsers(authUserId) {
    if (!authUserId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }
    return { status: 200, body: usersRepository.listDiscoverUsers(authUserId) };
  }

  function addContact({ ownerId, contactId, nickname }) {
    if (!ownerId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    const normalizedContactId = parsePositiveInt(contactId);
    if (!normalizedContactId) {
      return { status: 400, body: { error: 'Invalid contact id' } };
    }

    if (normalizedContactId === ownerId) {
      return { status: 400, body: { error: 'Cannot add yourself to contacts' } };
    }

    const target = usersRepository.findUserById(normalizedContactId);
    if (!target || target.deleted_at) {
      return { status: 404, body: { error: 'User not found' } };
    }

    const normalizedNickname = normalizeOptionalNickname(nickname);
    if (nickname != null && normalizedNickname == null) {
      return { status: 400, body: { error: 'Nickname must be 1-80 chars' } };
    }

    const info = usersRepository.addContact(ownerId, normalizedContactId, normalizedNickname);
    if (normalizedNickname && info.changes === 0) {
      usersRepository.updateContactNickname(ownerId, normalizedContactId, normalizedNickname);
    }
    return {
      status: 201,
      body: {
        success: true,
      },
    };
  }


  function updateCurrentUser({ userId, email, phoneNumber, name, context = {} }) {
    if (!userId) return { status: 401, body: { error: 'Unauthorized' } };
    const user = usersRepository.findUserById(userId);
    if (!user || user.deleted_at) return { status: 404, body: { error: 'User not found' } };

    const nextEmail = typeof email === 'string' ? email.trim().toLowerCase() : user.email;
    const nextName = typeof name === 'string' && name.trim() ? name.trim() : user.name;
    const nextPhone = phoneNumber == null ? (user.phone_number || null) : normalizePhoneNumber(phoneNumber);

    if (!isValidEmail(nextEmail)) return { status: 400, body: { error: 'Invalid email format' } };
    if (!nextPhone) return { status: 400, body: { error: 'Valid RU phone number is required (+7XXXXXXXXXX or 8XXXXXXXXXX)' } };

    const duplicate = usersRepository.findUserByEmailOrPhone(nextEmail, nextPhone);
    if (duplicate && duplicate.id !== userId) return { status: 400, body: { error: 'Email or phone already taken' } };

    const updatedUser = usersRepository.updateUserProfile(userId, nextEmail, nextPhone, nextName);
    const nextTokenVersion = updatedUser && Number.isInteger(updatedUser.token_version)
      ? updatedUser.token_version
      : (Number.isInteger(user.token_version) ? user.token_version + 1 : 2);

    if (complianceRepository && typeof complianceRepository.createEvent === 'function') {
      complianceRepository.createEvent({
        eventType: 'profile_update',
        status: 'accepted',
        userId,
        email: nextEmail,
        phone: nextPhone,
        authChannel: user.auth_channel || 'email',
        reason: 'self_service_update',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    const responseUser = {
      id: userId,
      email: nextEmail,
      phoneNumber: nextPhone,
      name: nextName,
      authChannel: user.auth_channel || 'email',
      tokenVersion: nextTokenVersion,
    };
    return {
      status: 200,
      body: {
        success: true,
        user: responseUser,
        ...(jwtAuthService && typeof jwtAuthService.issueToken === 'function'
          ? { token: jwtAuthService.issueToken(responseUser) }
          : {}),
      },
    };
  }

  function deleteCurrentUser({ userId, context = {} }) {
    if (!userId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    const user = usersRepository.findUserById(userId);
    if (!user || user.deleted_at) {
      return { status: 404, body: { error: 'User not found' } };
    }

    usersRepository.deleteUserData(userId, { hardDelete: hardDeleteUsers });

    if (complianceRepository && typeof complianceRepository.createEvent === 'function') {
      complianceRepository.createEvent({
        eventType: 'delete',
        status: 'accepted',
        userId,
        email: user.email,
        phone: user.phone_number || null,
        authChannel: user.auth_channel || 'email',
        reason: hardDeleteUsers ? 'hard_delete' : 'soft_delete',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
    }

    return {
      status: 200,
      body: {
        success: true,
        mode: hardDeleteUsers ? 'hard_delete' : 'soft_delete',
      },
    };
  }

  return {
    listUsers,
    discoverUsers,
    addContact,
    updateCurrentUser,
    deleteCurrentUser,
  };
}

module.exports = {
  buildUsersService,
};
