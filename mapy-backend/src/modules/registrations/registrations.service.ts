import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import { sendMail, registrationApprovedTemplate } from '../../config/mailer';
import { env } from '../../config/env';
import type { CreateRegistrationInput, ReviewRegistrationInput } from './registrations.schema';
import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export async function listRegistrations(query: any) {
  const { page, perPage, skip } = getPagination(query);
  const search = query.search?.trim();
  const statusFilter = query.status;

  const where: any = {
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(search
      ? {
          OR: [
            { agencyName: { contains: search } },
            { contactName: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {}),
  };

  const [total, data] = await Promise.all([
    prisma.agencyRegistration.count({ where }),
    prisma.agencyRegistration.findMany({
      where,
      skip,
      take: perPage,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { data, meta: buildMeta(total, page, perPage) };
}

export async function getRegistration(id: number) {
  const reg = await prisma.agencyRegistration.findUnique({ where: { id } });
  if (!reg) throw createError('Registration not found', 404);
  return reg;
}

export async function createRegistration(input: CreateRegistrationInput) {
  // Prevent duplicate pending applications from same email
  const existing = await prisma.agencyRegistration.findFirst({
    where: { email: input.email, status: 'pending' },
  });
  if (existing) throw createError('A pending application with this email already exists', 409);

  return prisma.agencyRegistration.create({ data: input });
}

export async function reviewRegistration(
  id: number,
  input: ReviewRegistrationInput,
  reviewedById: number,
) {
  const reg = await prisma.agencyRegistration.findUnique({ where: { id } });
  if (!reg) throw createError('Registration not found', 404);
  if (reg.status !== 'pending') {
    // Allow re-processing if it was "approved" but the agency was never actually created
    if (reg.status === 'approved' && input.status === 'approved') {
      const agencyExists = await prisma.agency.findFirst({ where: { email: reg.email } });
      if (agencyExists) throw createError('This registration has already been reviewed', 400);
      // Fall through — agency is missing, re-create it
    } else {
      throw createError('This registration has already been reviewed', 400);
    }
  }

  // Pre-validate the admin role exists before starting any transaction
  const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
  if (input.status === 'approved' && !adminRole) {
    throw createError('Admin role not found in database. Run the seed script first.', 500);
  }

  if (input.status === 'approved') {
    // Do everything atomically: mark registration approved + create agency + create user
    // If ANY step fails, nothing is committed — registration stays 'pending'
    const slug = slugify(reg.agencyName);
    const adminEmail = input.adminEmail ?? reg.email;
    const adminPassword = input.adminPassword ?? 'Admin@1234';
    const hashed = await bcrypt.hash(adminPassword, 12);
    const baseUsername = slug.replace(/-/g, '').slice(0, 15) + '_admin';

    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Mark the registration as approved
      const updatedReg = await tx.agencyRegistration.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedBy: reviewedById,
          reviewedAt: new Date(),
        },
      });

      // 2. Create the agency
      const agency = await tx.agency.create({
        data: {
          name: reg.agencyName,
          slug,
          email: reg.email,
          phone: reg.phone ?? undefined,
          address: reg.address ?? undefined,
          city: reg.city ?? undefined,
          country: reg.country ?? undefined,
          licenseNumber: reg.licenseNumber ?? undefined,
          status: 'active',
          registeredBy: reviewedById,
        },
      });

      // 3. Create the agency admin user
      await tx.user.create({
        data: {
          roleId: adminRole!.id,
          agencyId: agency.id,
          username: baseUsername,
          email: adminEmail,
          password: hashed,
          firstName: input.adminFirstName ?? reg.contactName.split(' ')[0] ?? 'Admin',
          lastName: input.adminLastName ?? reg.contactName.split(' ')[1] ?? '',
          emailVerified: true,
          isActive: true,
        },
      });

      return updatedReg;
    });

    // Send approval email outside the transaction (failure won't roll back the DB changes)
    try {
      await sendMail({
        to: reg.email,
        subject: `${reg.agencyName} — Your application has been approved!`,
        html: registrationApprovedTemplate(reg.agencyName, `${env.CLIENT_URL}/login`),
      });
    } catch {
      // Email failure is non-critical
    }

    return updated;
  }

  // For rejection: simple update, no transaction needed
  return prisma.agencyRegistration.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedBy: reviewedById,
      reviewedAt: new Date(),
    },
  });
}
