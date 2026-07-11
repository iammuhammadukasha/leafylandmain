import { randomUUID } from 'node:crypto';
import { VerifyVendorUseCase } from '../verify-vendor.use-case';
import { Vendor } from '../../../domain/entities/vendor.entity';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import {
  FakeAuditLogger,
  FakeUserRolesRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  VendorForbiddenError,
  VendorNotFoundError,
} from '../../../domain/errors/vendor.errors';

async function seedVendor(
  vendors: InMemoryVendorRepository,
  ownerUserId = 'owner-1',
): Promise<Vendor> {
  const vendor = Vendor.register({
    id: randomUUID(),
    ownerUserId,
    businessName: 'Green Leaf Organics',
    description: null,
    now: new Date(),
  });
  await vendors.save(vendor);
  return vendor;
}

function buildUseCase() {
  const vendors = new InMemoryVendorRepository();
  const userRoles = new FakeUserRolesRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new VerifyVendorUseCase(vendors, userRoles, auditLogger);

  return { useCase, vendors, userRoles, auditLogger };
}

describe('VerifyVendorUseCase', () => {
  it('approves a pending vendor when the actor is an admin', async () => {
    const { useCase, vendors, userRoles } = buildUseCase();
    const vendor = await seedVendor(vendors);
    userRoles.grant('admin-1', 'admin');

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      vendorId: vendor.id,
      decision: 'approved',
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('verified');
    expect(result.verifiedAt).not.toBeNull();
  });

  it('rejects a pending vendor with a reason when the actor is an admin', async () => {
    const { useCase, vendors, userRoles } = buildUseCase();
    const vendor = await seedVendor(vendors);
    userRoles.grant('admin-1', 'admin');

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      vendorId: vendor.id,
      decision: 'rejected',
      reason: 'Missing business registration.',
      ipAddress: null,
    });

    expect(result.status).toBe('rejected');
    expect(result.rejectedReason).toBe('Missing business registration.');
  });

  it('throws VendorForbiddenError when the actor is not an admin', async () => {
    const { useCase, vendors, userRoles } = buildUseCase();
    const vendor = await seedVendor(vendors);
    userRoles.grant('user-2', 'vendor_owner', vendor.id);

    await expect(
      useCase.execute({
        actorUserId: 'user-2',
        vendorId: vendor.id,
        decision: 'approved',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorForbiddenError);
  });

  it('throws VendorNotFoundError for a nonexistent vendor id', async () => {
    const { useCase, userRoles } = buildUseCase();
    userRoles.grant('admin-1', 'admin');

    await expect(
      useCase.execute({
        actorUserId: 'admin-1',
        vendorId: randomUUID(),
        decision: 'approved',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
  });

  it('records vendor.verified / vendor.rejected audit events on decision', async () => {
    const { useCase, vendors, userRoles, auditLogger } = buildUseCase();
    const vendor = await seedVendor(vendors);
    userRoles.grant('admin-1', 'admin');

    await useCase.execute({
      actorUserId: 'admin-1',
      vendorId: vendor.id,
      decision: 'approved',
      ipAddress: null,
    });

    expect(auditLogger.events.map((e) => e.action)).toContain(
      'vendor.verified',
    );
  });
});
