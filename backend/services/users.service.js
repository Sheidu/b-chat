function buildUsersService({ usersRepository }) {
  function listUsers() {
    return { status: 200, body: usersRepository.listUsers() };
  }

  return {
    listUsers,
  };
}

module.exports = {
  buildUsersService,
};
