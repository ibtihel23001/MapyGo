import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateUserInput, UpdateUserInput, UpdateProfileInput } from './users.schema';

const safeSelect = {
  id: true, username: true, email: true, firstName: true, lastName: true,
  phone: true, avatar: true, isActive: true, emailVerified: true, lastLogin: true,
  createdAt: true, agencyId: true,
  role: { select: { id: true, name: true, slug: true } },
  agency: { select: { id: true, name: true } },
};

export async function listByRole(roleSlug: 'admin' | 'accountant', query: any, agencyId?: number | null) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();

  const where: any = {
    role: { slug: roleSlug },
    ...(agencyId ? { agencyId } : {}),
    ...(search ? {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ],
    } : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' }, select: safeSelect }),
  ]);

  return { data: users, meta: buildMeta(total, page, perPage) };
}

export async function getUser(id: number) {
  const user = await prisma.user.findUnique({ where: { id }, select: safeSelect });
  if (!user) throw createError('User not found', 404);
  return user;
}

export async function createUser(input: CreateUserInput) {
  const [emailExists, usernameExists] = await Promise.all([
    prisma.user.findUnique({ where: { email: input.email } }),
    prisma.user.findUnique({ where: { username: input.username } }),
  ]);

  if (emailExists) throw createError('Email already in use', 409);
  if (usernameExists) throw createError('Username already taken', 409);

  const role = await prisma.role.findUnique({ where: { slug: input.roleSlug } });
  if (!role) throw createError('Role not found', 400);

  const hashed = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      email: input.email,
      password: hashed,
      phone: input.phone,
      roleId: role.id,
      agencyId: input.agencyId,
      emailVerified: true,
    },
    select: safeSelect,
  });

  return user;
}

export async function updateUser(id: number, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found', 404);

  return prisma.user.update({ where: { id }, data: input, select: safeSelect });
}

export async function toggleStatus(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found', 404);

  return prisma.user.update({
    where: { id },
    data: { isActive: !user.isActive },
    select: safeSelect,
  });
}

export async function deleteUser(id: number, requesterId: number) {
  if (id === requesterId) throw createError('Cannot delete your own account', 400);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw createError('User not found', 404);

  await prisma.user.delete({ where: { id } });
}

export async function updateProfile(userId: number, input: UpdateProfileInput, avatarPath?: string) {
  if (input.username) {
    const existing = await prisma.user.findFirst({
      where: { username: input.username, NOT: { id: userId } },
    });
    if (existing) throw createError('Username already taken', 409);
  }

  return prisma.user.update({
    where: { id: userId },
    data: { ...input, ...(avatarPath ? { avatar: avatarPath } : {}) },
    select: safeSelect,
  });
}
