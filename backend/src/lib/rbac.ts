import { UserRole } from '@prisma/client';
import { prisma } from './prisma.js';

export async function assertAdminOrOwner(userId: string, organizationId: string) {
    const member = await prisma.user.findFirst({
        where: {
            id: userId,
            organizationId,
        },
        select: {
            role: true,
        },
    });

    if (!member) {
        throw new Error('User not found in organization');
    }

    if (member.role !== UserRole.OWNER && member.role !== UserRole.ADMIN) {
        throw new Error('Forbidden');
    }

    return member.role;
}
