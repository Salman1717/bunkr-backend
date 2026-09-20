import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { filsToAedString } from '../../../shared/money/fils';

describe('Bunkr Primary Acceptance E2E Suite', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let cookToken: string;
  let cycleId: string;
  let arunId: string;
  let bilalId: string;
  let chenId: string;
  let devId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Primary September Benchmark Scenario', () => {
    it('seeds and verifies exact closing balances for September benchmark', async () => {
      // 1. Clean Database
      await prisma.auditLog.deleteMany();
      await prisma.statement.deleteMany();
      await prisma.ledgerEntry.deleteMany();
      await prisma.payment.deleteMany();
      await prisma.adjustment.deleteMany();
      await prisma.expenseSplit.deleteMany();
      await prisma.expense.deleteMany();
      await prisma.waterTake.deleteMany();
      await prisma.waterDelivery.deleteMany();
      await prisma.absence.deleteMany();
      await prisma.setting.deleteMany();
      await prisma.membership.deleteMany();
      await prisma.bed.deleteMany();
      await prisma.room.deleteMany();
      await prisma.cycle.deleteMany();
      await prisma.member.deleteMany();

      // 2. Create Members
      const bcrypt = await import('bcrypt');
      const passwordHash = await bcrypt.hash('Password123!', 10);

      const arun = await prisma.member.create({
        data: {
          email: 'arun@bunkr.ae',
          passwordHash,
          firstName: 'Arun',
          lastName: 'Kumar',
          isAdmin: true,
        },
      });
      arunId = arun.id;

      const bilal = await prisma.member.create({
        data: {
          email: 'bilal@bunkr.ae',
          passwordHash,
          firstName: 'Bilal',
          lastName: 'Ahmed',
          isAdmin: false,
        },
      });
      bilalId = bilal.id;

      const chen = await prisma.member.create({
        data: {
          email: 'chen@bunkr.ae',
          passwordHash,
          firstName: 'Chen',
          lastName: 'Wei',
          isAdmin: false,
        },
      });
      chenId = chen.id;

      const dev = await prisma.member.create({
        data: {
          email: 'dev@bunkr.ae',
          passwordHash,
          firstName: 'Dev',
          lastName: 'Patel',
          isAdmin: false,
        },
      });
      devId = dev.id;

      // Login to obtain JWT tokens
      const loginRes = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'arun@bunkr.ae', password: 'Password123!' });

      expect(loginRes.status).toBe(201);
      adminToken = loginRes.body.accessToken;

      // 3. Create September Cycle
      const cycleRes = await request(app.getHttpServer())
        .post('/api/cycles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '2026-09',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-30T23:59:59.000Z',
        });
      expect(cycleRes.status).toBe(201);
      cycleId = cycleRes.body.id;

      // 4. Create Rooms & Beds
      const room1Res = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Room 1', description: 'Master Bedroom' });

      const room2Res = await request(app.getHttpServer())
        .post('/api/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Room 2', description: 'Second Bedroom' });

      const bed1ARes = await request(app.getHttpServer())
        .post('/api/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roomId: room1Res.body.id, name: 'Bed 1A', defaultRentFils: '75000' });

      const bed1BRes = await request(app.getHttpServer())
        .post('/api/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roomId: room1Res.body.id, name: 'Bed 1B', defaultRentFils: '75000' });

      const bed2ARes = await request(app.getHttpServer())
        .post('/api/beds')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roomId: room2Res.body.id, name: 'Bed 2A', defaultRentFils: '65000' });

      // 5. Create Memberships
      // Arun: Room 1 Bed 1A, Mess (Cook), Water
      await prisma.membership.create({
        data: {
          memberId: arunId,
          type: 'ROOM',
          bedId: bed1ARes.body.id,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: arunId,
          type: 'MESS',
          isCook: true,
          cookStartDate: new Date('2026-09-01T00:00:00.000Z'),
          cookEndDate: new Date('2026-09-30T23:59:59.000Z'),
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: arunId,
          type: 'WATER',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      // Bilal: Room 1 Bed 1B, Mess, Water
      await prisma.membership.create({
        data: {
          memberId: bilalId,
          type: 'ROOM',
          bedId: bed1BRes.body.id,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: bilalId,
          type: 'MESS',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: bilalId,
          type: 'WATER',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      // Chen: Room 2 Bed 2A, Mess, Water
      await prisma.membership.create({
        data: {
          memberId: chenId,
          type: 'ROOM',
          bedId: bed2ARes.body.id,
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: chenId,
          type: 'MESS',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });
      await prisma.membership.create({
        data: {
          memberId: chenId,
          type: 'WATER',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      // Dev: Mess only
      await prisma.membership.create({
        data: {
          memberId: devId,
          type: 'MESS',
          startDate: new Date('2026-09-01T00:00:00.000Z'),
        },
      });

      // 6. House Settings
      await prisma.setting.create({
        data: {
          key: 'cook_charge_per_member',
          valueJson: 5000,
          createdById: arunId,
        },
      });
      await prisma.setting.create({
        data: {
          key: 'water_split_mode',
          valueJson: 'BY_CONSUMPTION',
          createdById: arunId,
        },
      });

      // 7. Absences (Bilal: 2 days absent = 28 consumed; Dev: 18 days absent = 12 consumed)
      await prisma.absence.create({
        data: {
          memberId: bilalId,
          cycleId,
          date: new Date('2026-09-15T00:00:00.000Z'),
          breakfast: false,
          lunch: false,
          dinner: false,
          status: 'APPROVED',
        },
      });
      await prisma.absence.create({
        data: {
          memberId: bilalId,
          cycleId,
          date: new Date('2026-09-16T00:00:00.000Z'),
          breakfast: false,
          lunch: false,
          dinner: false,
          status: 'APPROVED',
        },
      });

      for (let i = 1; i <= 18; i++) {
        const dayStr = i < 10 ? `0${i}` : `${i}`;
        await prisma.absence.create({
          data: {
            memberId: devId,
            cycleId,
            date: new Date(`2026-09-${dayStr}T00:00:00.000Z`),
            breakfast: false,
            lunch: false,
            dinner: false,
            status: 'APPROVED',
          },
        });
      }

      // 8. Expenses & Water
      // Groceries 2,400.00 AED (240,000 fils) paid by Arun
      await prisma.expense.create({
        data: {
          cycleId,
          submittedById: arunId,
          category: 'GROCERY',
          splitScope: 'ALL_MEMBERS',
          amountFils: 240000n,
          description: 'September Groceries',
          status: 'APPROVED',
          approvedById: arunId,
        },
      });

      // Water heater 300.00 AED (30,000 fils) SINGLE_ROOM Room 1
      const heater = await prisma.expense.create({
        data: {
          cycleId,
          submittedById: null,
          category: 'ROOM',
          splitScope: 'SINGLE_ROOM',
          targetRoomId: room1Res.body.id,
          amountFils: 30000n,
          description: 'Water heater Room 1',
          status: 'APPROVED',
          approvedById: arunId,
        },
      });
      await prisma.expenseSplit.create({
        data: { expenseId: heater.id, memberId: arunId, shareFils: 15000n },
      });
      await prisma.expenseSplit.create({
        data: { expenseId: heater.id, memberId: bilalId, shareFils: 15000n },
      });

      // Washing powder 45.00 AED (4,500 fils) ALL_ROOM paid by Bilal
      const powder = await prisma.expense.create({
        data: {
          cycleId,
          submittedById: bilalId,
          category: 'SHARED_ITEM',
          splitScope: 'ALL_ROOM',
          amountFils: 4500n,
          description: 'Washing powder',
          status: 'APPROVED',
          approvedById: arunId,
        },
      });
      await prisma.expenseSplit.create({
        data: { expenseId: powder.id, memberId: arunId, shareFils: 1500n },
      });
      await prisma.expenseSplit.create({
        data: { expenseId: powder.id, memberId: bilalId, shareFils: 1500n },
      });
      await prisma.expenseSplit.create({
        data: { expenseId: powder.id, memberId: chenId, shareFils: 1500n },
      });

      // Water: 20 bottles @ 700 fils = 14,000 fils (Arun 7, Bilal 7, Chen 6)
      const waterDelivery = await prisma.waterDelivery.create({
        data: {
          cycleId,
          date: new Date('2026-09-10T00:00:00.000Z'),
          bottleCount: 20,
          unitPriceFils: 700n,
          loggedById: arunId,
        },
      });
      await prisma.waterTake.create({
        data: { waterDeliveryId: waterDelivery.id, memberId: arunId, bottleCount: 7 },
      });
      await prisma.waterTake.create({
        data: { waterDeliveryId: waterDelivery.id, memberId: bilalId, bottleCount: 7 },
      });
      await prisma.waterTake.create({
        data: { waterDeliveryId: waterDelivery.id, memberId: chenId, bottleCount: 6 },
      });

      // 9. Execute Cycle Preview GET /api/cycles/:id/preview
      const previewRes = await request(app.getHttpServer())
        .get(`/api/cycles/${cycleId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(previewRes.status).toBe(200);

      const data = previewRes.body;
      expect(data.totalManDays).toBe(100);
      expect(data.dailyRateFils).toBe('2400');
      expect(data.groceryTotalFils).toBe('240000');
      expect(data.totalChargesFils).toBe('523500'); // 5,235.00 AED

      const arunPreview = data.members.find((m: any) => m.memberId === arunId);
      const bilalPreview = data.members.find((m: any) => m.memberId === bilalId);
      const chenPreview = data.members.find((m: any) => m.memberId === chenId);
      const devPreview = data.members.find((m: any) => m.memberId === devId);

      // Verify exact expected balances in fils and AED
      expect(arunPreview.closingBalanceFils).toBe('-86600');
      expect(filsToAedString(BigInt(arunPreview.closingBalanceFils))).toBe('-866.00');

      expect(bilalPreview.closingBalanceFils).toBe('164100');
      expect(filsToAedString(BigInt(bilalPreview.closingBalanceFils))).toBe('1641.00');

      expect(chenPreview.closingBalanceFils).toBe('147700');
      expect(filsToAedString(BigInt(chenPreview.closingBalanceFils))).toBe('1477.00');

      expect(devPreview.closingBalanceFils).toBe('33800');
      expect(filsToAedString(BigInt(devPreview.closingBalanceFils))).toBe('338.00');

      // 10. Execute Transactional Month Close POST /api/cycles/:id/close
      const closeRes = await request(app.getHttpServer())
        .post(`/api/cycles/${cycleId}/close`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(closeRes.status).toBe(201);
      expect(closeRes.body.preview).toBeDefined();

      const updatedCycle = await prisma.cycle.findUnique({ where: { id: cycleId } });
      expect(updatedCycle?.status).toBe('CLOSED');
    });
  });

  describe('Additional Edge Cases Verification', () => {
    it('blocks a cook from approving their own grocery expense (CookSelfApprovalGuard)', async () => {
      // Create a pending grocery expense submitted by Arun (who is a cook)
      const expense = await prisma.expense.create({
        data: {
          cycleId,
          submittedById: arunId,
          category: 'GROCERY',
          splitScope: 'ALL_MEMBERS',
          amountFils: 50000n,
          description: 'Mid-week vegetables',
          status: 'PENDING',
        },
      });

      // Arun (admin + cook) attempts to approve their own grocery bill
      const approveRes = await request(app.getHttpServer())
        .post(`/api/expenses/${expense.id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(approveRes.status).toBe(403);
      expect(approveRes.body.message).toContain('Cooks cannot approve their own grocery bills');
    });

    it('netting reversed adjustment to zero', async () => {
      // Reopen cycle for test
      await request(app.getHttpServer())
        .post(`/api/cycles/${cycleId}/reopen`)
        .set('Authorization', `Bearer ${adminToken}`);

      // Post adjustment: 50 AED debit to Bilal
      const adjRes = await request(app.getHttpServer())
        .post('/api/adjustments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          memberId: bilalId,
          cycleId,
          direction: 'DEBIT',
          amountFils: '5000',
          category: 'DAMAGE',
          reason: 'Broken glass in common dining table area',
        });

      expect(adjRes.status).toBe(201);
      const adjId = adjRes.body.id;

      // Reverse adjustment
      const revRes = await request(app.getHttpServer())
        .post(`/api/adjustments/${adjId}/reverse`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(revRes.status).toBe(201);
      expect(revRes.body.direction).toBe('CREDIT');
      expect(revRes.body.reversesId).toBe(adjId);

      // Verify net effect in preview remains unchanged
      const previewRes = await request(app.getHttpServer())
        .get(`/api/cycles/${cycleId}/preview`)
        .set('Authorization', `Bearer ${adminToken}`);

      const bilalPreview = previewRes.body.members.find((m: any) => m.memberId === bilalId);
      expect(bilalPreview.closingBalanceFils).toBe('164100'); // remains 1,641.00 AED net!
    });
  });
});
