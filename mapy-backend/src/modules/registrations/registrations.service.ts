import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import { sendMail, registrationApprovedTemplate } from '../../config/mailer';
import { env } from '../../config/env';
import type { CreateRegistrationInput, ReviewRegistrationInput } from './registrations.schema';
import { Prisma } from '@prisma/client';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/** Make a slug unique by appending -2, -3, … if it already exists in agencies */
async function uniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let counter = 2;
  while (await prisma.agency.findUnique({ where: { slug: candidate } })) {
    candidate = `${base}-${counter++}`;
  }
  return candidate;
}

/** Make a username unique by appending 2, 3, … if it already exists in users */
async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  let counter = 2;
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    candidate = `${base}${counter++}`;
  }
  return candidate;
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
    // Allow re-processing only if it was "approved" but the agency was never actually created
    if (reg.status === 'approved' && input.status === 'approved') {
      const agencyExists = await prisma.agency.findFirst({ where: { email: reg.email } });
      if (agencyExists) throw createError('This registration has already been approved', 400);
      // Fall through — agency is missing, re-create it
    } else {
      throw createError('This registration has already been reviewed', 400);
    }
  }

  if (input.status === 'approved') {
    // Pre-validate the admin role exists before starting any transaction
    const adminRole = await prisma.role.findUnique({ where: { slug: 'admin' } });
    if (!adminRole) {
      throw createError('Admin role not found in database. Run the seed script first.', 500);
    }

    // Check admin email isn't already taken by another user
    const adminEmail = input.adminEmail?.trim() || reg.email;
    const emailTaken = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (emailTaken) {
      throw createError(
        `The email "${adminEmail}" is already registered. Please provide a different admin email.`,
        409,
      );
    }

    // Build unique slug and username (prevents P2002 unique-constraint crashes)
    const baseSlug = slugify(reg.agencyName);
    const slug = await uniqueSlug(baseSlug);
    const baseUsername = baseSlug.replace(/-/g, '').slice(0, 15) + '_admin';
    const username = await uniqueUsername(baseUsername);

    const adminPassword = input.adminPassword?.trim() || 'Admin@1234';
    const hashed = await bcrypt.hash(adminPassword, 12);

    let updated: Prisma.AgencyRegistrationGetPayload<{}>;

    try {
      updated = await prisma.$transaction(async (tx) => {
        // 1. Mark the registration as approved
        const updatedReg = await tx.agencyRegistration.update({
          where: { id },
          data: {
            status: 'approved',
            reviewedBy: reviewedById,
            reviewedAt: new Date(),
          },
        });

        // 2. Create the agency in the agencies table
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
            roleId: adminRole.id,
            agencyId: agency.id,
            username,
            email: adminEmail,
            password: hashed,
            firstName: input.adminFirstName?.trim() || reg.contactName.split(' ')[0] || 'Admin',
            lastName: input.adminLastName?.trim() || reg.contactName.split(' ')[1] || '',
            emailVerified: true,
            isActive: true,
          },
        });

        return updatedReg;
      });
    } catch (err: any) {
      // Prisma unique-constraint violation — give a clear message instead of 500
      if (err?.code === 'P2002') {
        const field: string = err.meta?.target?.[0] ?? 'field';
        throw createError(
          `A record with this ${field} already exists. Please check the agency name or email and try again.`,
          409,
        );
      }
      throw err; // re-throw anything else
    }

    // Send approval email outside the transaction (failure won't roll back DB changes)
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

  // Rejection: simple update, no transaction needed
  return prisma.agencyRegistration.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewedBy: reviewedById,
      reviewedAt: new Date(),
    },
  });
}
