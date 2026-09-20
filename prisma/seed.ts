import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial clean database for Step 1...');

  // Clean tables
  await prisma.membership.deleteMany();
  await prisma.bed.deleteMany();
  await prisma.room.deleteMany();
  await prisma.member.deleteMany();

  const superAdminPasswordHash = await bcrypt.hash('Admin@12345', 10);

  // 1. Create Super Admin Member
  const superAdmin = await prisma.member.create({
    data: {
      email: 'admin@103.com',
      passwordHash: superAdminPasswordHash,
      firstName: 'Super',
      lastName: 'Admin',
      isAdmin: true,
    },
  });

  // 2. Create Rooms & Beds
  const room1 = await prisma.room.create({
    data: {
      name: 'Room 1 (Master)',
      description: 'Master bedroom with balcony',
    },
  });

  const room2 = await prisma.room.create({
    data: {
      name: 'Room 2 (Standard)',
      description: 'Second bedroom with attached bath',
    },
  });

  await prisma.bed.create({
    data: { roomId: room1.id, name: 'Bed 1A', defaultRentFils: 75000n }, // 750 AED
  });

  await prisma.bed.create({
    data: { roomId: room1.id, name: 'Bed 1B', defaultRentFils: 75000n }, // 750 AED
  });

  await prisma.bed.create({
    data: { roomId: room2.id, name: 'Bed 2A', defaultRentFils: 65000n }, // 650 AED
  });

  console.log(`Clean database seeded with Super Admin (${superAdmin.email}) and default Rooms (Room 1, Room 2).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
