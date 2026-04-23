function buildUsersService({ usersRepository, complianceRepository, hardDeleteUsers = false }) {
  function listUsers(authUserId) {
    if (!authUserId) {
      return { status: 401, body: { error: 'Unauthorized' } };
    }

    return { status: 200, body: usersRepository.listContactsForUser(authUserId) };
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
    deleteCurrentUser,
  };
}

module.exports = {
  buildUsersService,
};
