import logger from '#config/logger.js';
import { formatValidationError } from '#utils/format.js';
import {
  getAllUsers,
  getUserById as getUserByIdService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from '#services/users.service.js';
import {
  updateUserSchema,
  userIdSchema,
} from '#validations/users.validation.js';

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting users...');

    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved users',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error('Error fetching all users', e);
    next(e);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    logger.info(`Getting user by id: ${id}`);

    const user = await getUserByIdService(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (e) {
    logger.error('Error fetching user by id', e);
    next(e);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const idResult = userIdSchema.safeParse({ id: req.params.id });

    if (!idResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(idResult.error),
      });
    }

    const bodyResult = updateUserSchema.safeParse(req.body);

    if (!bodyResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(bodyResult.error),
      });
    }

    const { id } = idResult.data;
    const updates = bodyResult.data;

    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isSelf = Number(authUser.id) === id;
    const isAdmin = authUser.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Forbidden: cannot update other users' });
    }

    if (!isAdmin && Object.prototype.hasOwnProperty.call(updates, 'role')) {
      return res
        .status(403)
        .json({ error: 'Forbidden: only admin can change user role' });
    }

    logger.info(`Updating user ${id} by ${authUser.email || authUser.id}`);

    const user = await updateUserService(id, updates);

    res.json({
      message: 'User updated successfully',
      user,
    });
  } catch (e) {
    logger.error('Error updating user', e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse({ id: req.params.id });

    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: formatValidationError(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const isSelf = Number(authUser.id) === id;
    const isAdmin = authUser.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res
        .status(403)
        .json({ error: 'Forbidden: cannot delete other users' });
    }

    logger.info(`Deleting user ${id} by ${authUser.email || authUser.id}`);

    const deleted = await deleteUserService(id);

    res.json({
      message: 'User deleted successfully',
      user: deleted,
    });
  } catch (e) {
    logger.error('Error deleting user', e);

    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }

    next(e);
  }
};
