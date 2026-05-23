import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import type { CreateAgencyInput, UpdateAgencyInput, UpdateStatusInput } from './agencies.schema';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function listAgencies(query: { page?: string; perPage?: string; search?: string }) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();

  const where = search
    ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { city: { contains: search } },
          { country: { contains: search } },
        ],
      }
    : {};

  const [total, agencies] = await Promise.all([
    prisma.agency.count({ where }),
    prisma.agency.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { tickets: true, users: true } },
        subscriptions: {
          where: { status: 'active' },
          orderBy: { endDate: 'desc' },
          take: 1,
        },
      },
    }),
  ]);

  return { data: agencies, meta: buildMeta(total, page, perPage) };
}

export async function getAgency(id: number) {
  const agency = await prisma.agency.findUnique({
    where: { id },
    include: {
      users: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true },
      },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 5 },
      _count: { select: { tickets: true, clients: true, sellers: true } },
    },
  });

  if (!agency) throw createError('Agency not found', 404);
  return agency;
}

export async function createAgency(input: CreateAgencyInput, createdById: number) {
  const slug = slugify(input.name);
  const existing = await prisma.agency.findUnique({ where: { slug } });
  if (existing) throw createError('Agency name already taken', 409);

  return prisma.agency.create({
    data: { ...input, slug, registeredBy: createdById },
  });
}

export async function updateAgency(id: number, input: UpdateAgencyInput) {
  const agency = await prisma.agency.findUnique({ where: { id } });
  if (!agency) throw createError('Agency not found', 404);

  return prisma.agency.update({ where: { id }, data: input });
}

export async function updateAgencyStatus(id: number, input: UpdateStatusInput) {
  const agency = await prisma.agency.findUnique({ where: { id } });
  if (!agency) throw createError('Agency not found', 404);

  return prisma.agency.update({ where: { id }, data: { status: input.status } });
}

export async function deleteAgency(id: number) {
  const agency = await prisma.agency.findUnique({ where: { id } });
  if (!agency) throw createError('Agency not found', 404);

  await prisma.agency.delete({ where: { id } });
}
