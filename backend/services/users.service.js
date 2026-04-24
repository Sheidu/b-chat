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

function buildUsersService({ usersRepository, complianceRepository, hardDeleteUsers = false }) {
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
    deleteCurrentUser,
  };
}

module.exports = {
  buildUsersService,
};
