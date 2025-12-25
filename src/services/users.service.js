import logger from '#config/logger.js';
import { db } from '#config/database.js';
import { users } from '#models/user.model.js';
import { eq } from 'drizzle-orm';

const userSelection = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  created_at: users.created_at,
  updated_at: users.updated_at,
};

export const getAllUsers = async () => {
  try {
    return await db.select(userSelection).from(users);
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async id => {
  try {
    const result = await db
      .select(userSelection)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return result[0] || null;
  } catch (e) {
    logger.error(`Error getting user by id: ${id}`, e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('User not found');
    }

    const allowedFields = ['name', 'email', 'role'];
    const payload = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(updates, field)) {
        payload[field] = updates[field];
      }
    }

    if (Object.keys(payload).length === 0) {
      // Nothing to update; return the existing user data
      const [user] = await db
        .select(userSelection)
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return user;
    }

    const [updatedUser] = await db
      .update(users)
      .set(payload)
      .where(eq(users.id, id))
      .returning(userSelection);

    logger.info(`User ${updatedUser.email} updated successfully`);
    return updatedUser;
  } catch (e) {
    logger.error(`Error updating user ${id}`, e);
    throw e;
  }
};

export const deleteUser = async id => {
  try {
    const [deleted] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning(userSelection);

    if (!deleted) {
      throw new Error('User not found');
    }

    logger.info(`User ${deleted.email} deleted successfully`);
    return deleted;
  } catch (e) {
    logger.error(`Error deleting user ${id}`, e);
    throw e;
  }
};
