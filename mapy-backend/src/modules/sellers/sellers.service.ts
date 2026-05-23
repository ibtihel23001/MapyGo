import prisma from '../../config/prisma';
import { getPagination, buildMeta } from '../../utils/paginate';
import { createError } from '../../middleware/errorHandler';
import { z } from 'zod';

// ─── Schemas ────────────────────────────────────────────────
export const sellerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export const clientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  passportNumber: z.string().optional(),
  nationality: z.string().optional(),
});

// ─── Sellers service ─────────────────────────────────────────
export async function listSellers(query: any, agencyId: number) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();
  const where: any = {
    agencyId,
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.seller.count({ where }),
    prisma.seller.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  return { data, meta: buildMeta(total, page, perPage) };
}

export async function createSeller(input: z.infer<typeof sellerSchema>, agencyId: number) {
  return prisma.seller.create({ data: { ...input, agencyId } });
}

export async function updateSeller(id: number, input: z.infer<typeof sellerSchema>, agencyId: number) {
  const seller = await prisma.seller.findFirst({ where: { id, agencyId } });
  if (!seller) throw createError('Seller not found', 404);
  return prisma.seller.update({ where: { id }, data: input });
}

export async function deleteSeller(id: number, agencyId: number) {
  const seller = await prisma.seller.findFirst({ where: { id, agencyId } });
  if (!seller) throw createError('Seller not found', 404);
  await prisma.seller.delete({ where: { id } });
}

// ─── Clients service ─────────────────────────────────────────
export async function listClients(query: any, agencyId: number) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();
  const where: any = {
    agencyId,
    ...(search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }, { passportNumber: { contains: search } }] } : {}),
  };

  const [total, data] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, skip, take: perPage, orderBy: { createdAt: 'desc' } }),
  ]);

  return { data, meta: buildMeta(total, page, perPage) };
}

export async function createClient(input: z.infer<typeof clientSchema>, agencyId: number) {
  return prisma.client.create({ data: { ...input, agencyId } });
}

export async function updateClient(id: number, input: z.infer<typeof clientSchema>, agencyId: number) {
  const client = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!client) throw createError('Client not found', 404);
  return prisma.client.update({ where: { id }, data: input });
}

export async function deleteClient(id: number, agencyId: number) {
  const client = await prisma.client.findFirst({ where: { id, agencyId } });
  if (!client) throw createError('Client not found', 404);
  await prisma.client.delete({ where: { id } });
}
