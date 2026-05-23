import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import type { UpsertApiConfigInput } from './api-config.schema';

export async function getConfig(agencyId: number) {
  const config = await prisma.agencyApiConfig.findUnique({ where: { agencyId } });
  if (!config) return null;

  // Never expose the raw password — mask it
  return { ...config, emailPassword: '••••••••' };
}

export async function upsertConfig(agencyId: number, input: UpsertApiConfigInput) {
  const agency = await prisma.agency.findUnique({ where: { id: agencyId } });
  if (!agency) throw createError('Agency not found', 404);

  return prisma.agencyApiConfig.upsert({
    where: { agencyId },
    create: { agencyId, ...input },
    update: input,
  });
}

export async function deleteConfig(agencyId: number) {
  const config = await prisma.agencyApiConfig.findUnique({ where: { agencyId } });
  if (!config) throw createError('Config not found', 404);
  await prisma.agencyApiConfig.delete({ where: { agencyId } });
}

export async function updateLastSync(agencyId: number) {
  await prisma.agencyApiConfig.update({
    where: { agencyId },
    data: { lastSync: new Date() },
  });
}
