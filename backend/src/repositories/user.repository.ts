import type { PrismaClient, User, Prisma } from '../generated/prisma/client/index.js';
import prisma from '../config/database.js';

export function createUserRepository(db: PrismaClient = prisma) {
  return {
    async findById(id: string): Promise<User | null> {
      return db.user.findUnique({ where: { id } });
    },

    async findByAuth0Id(auth0Id: string): Promise<User | null> {
      return db.user.findUnique({ where: { auth0Id } });
    },

    async findByEmail(email: string): Promise<User | null> {
      return db.user.findUnique({ where: { email } });
    },

    async create(data: Prisma.UserCreateInput): Promise<User> {
      return db.user.create({ data });
    },

    async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
      return db.user.update({ where: { id }, data });
    },
  };
}

export const userRepository = createUserRepository();
