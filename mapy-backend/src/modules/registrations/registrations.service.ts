import bcrypt from 'bcryptjs';
import prisma from '../../config/prisma';
import { createError } from '../../middleware/errorHandler';
import { getPagination, buildMeta } from '../../utils/paginate';
import { sendMail, registrationApprovedTemplate } from '../../config/mailer';
import { env } from '../../config/env';
import type { CreateRegistrationInput, ReviewRegistrationInput } from './registrations.schema';

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
  if (reg.status !== 'pending') throw createError('This registration has already been reviewed', 400);

  // Mark reviewed first
  const updated = await prisma.agencyRegistration.update({
    where: { id },
    data: {
      status: input.status,
      reviewedBy: reviewedById,
      reviewedAt: new Date(),
    },
  });

  // On approval: create Agency + Admin user in a transaction
  if (input.status === 'approved') {
    const slug = slugify(reg.agencyName);

    await prisma.$transaction(async (tx) => {
      // Create the agency
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

      // Create admin user for the agency
      const adminRole = await tx.role.findUnique({ where: { slug: 'admin' } });
      if (!adminRole) throw new Error('Admin role not found in DB');

      const adminEmail = input.adminEmail ?? reg.email;
      const adminPassword = input.adminPassword ?? 'Admin@1234'; // agency should change on first login
      const hashed = await bcrypt.hash(adminPassword, 12);
      const baseUsername = slug.replace(/-/g, '').slice(0, 15) + '_admin';

      await tx.user.create({
        data: {
          roleId: adminRole.id,
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

      // Send approval email
      try {
        await sendMail({
          to: reg.email,
          subject: `${reg.agencyName} — Your application has been approved!`,
          html: registrationApprovedTemplate(reg.agencyName, `${env.CLIENT_URL}/login`),
        });
      } catch {
        // Email failure shouldn't roll back the transaction
      }
    });
  }

  return updated;
}
