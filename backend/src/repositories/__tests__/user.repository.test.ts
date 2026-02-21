import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { testPrisma, cleanDatabase } from '../../tests/helpers/prisma.js';
import { createUserRepository } from '../user.repository.js';
import { createUserData } from '../../tests/helpers/fixtures.js';

const userRepo = createUserRepository(testPrisma);

beforeAll(async () => {
  await cleanDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await testPrisma.$disconnect();
});

describe('userRepository', () => {
  describe('create', () => {
    it('should create a user', async () => {
      const data = createUserData();
      const user = await userRepo.create(data);

      expect(user.id).toBeDefined();
      expect(user.auth0Id).toBe(data.auth0Id);
      expect(user.email).toBe(data.email);
      expect(user.username).toBeNull();
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('should create a user with optional fields', async () => {
      const data = createUserData({
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
      });
      const user = await userRepo.create(data);

      expect(user.username).toBe('testuser');
      expect(user.avatarUrl).toBe('https://example.com/avatar.jpg');
    });

    it('should reject duplicate auth0Id', async () => {
      const data = createUserData();
      await userRepo.create(data);

      await expect(userRepo.create({ ...data, email: 'other@test.com' })).rejects.toThrow();
    });

    it('should reject duplicate email', async () => {
      const data = createUserData();
      await userRepo.create(data);

      await expect(userRepo.create({ ...data, auth0Id: 'auth0|other' })).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should find a user by id', async () => {
      const created = await userRepo.create(createUserData());
      const found = await userRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('should return null for non-existent id', async () => {
      const found = await userRepo.findById('non-existent-id');
      expect(found).toBeNull();
    });
  });

  describe('findByAuth0Id', () => {
    it('should find a user by auth0Id', async () => {
      const data = createUserData();
      await userRepo.create(data);
      const found = await userRepo.findByAuth0Id(data.auth0Id);

      expect(found).not.toBeNull();
      expect(found!.auth0Id).toBe(data.auth0Id);
    });
  });

  describe('findByEmail', () => {
    it('should find a user by email', async () => {
      const data = createUserData();
      await userRepo.create(data);
      const found = await userRepo.findByEmail(data.email);

      expect(found).not.toBeNull();
      expect(found!.email).toBe(data.email);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      const created = await userRepo.create(createUserData());
      const updated = await userRepo.update(created.id, { username: 'newname' });

      expect(updated.username).toBe('newname');
      expect(updated.id).toBe(created.id);
    });
  });
});
