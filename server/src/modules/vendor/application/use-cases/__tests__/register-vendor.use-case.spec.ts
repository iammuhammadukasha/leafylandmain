import { RegisterVendorUseCase } from '../register-vendor.use-case';
import { InMemoryVendorRepository } from '../../__tests__/fakes/in-memory-vendor.repository';
import {
  FakeAuditLogger,
  FakeVendorRoleGrantRepository,
} from '../../__tests__/fakes/fake-ports';
import { VendorAlreadyExistsError } from '../../../domain/errors/vendor.errors';

function buildUseCase() {
  const vendors = new InMemoryVendorRepository();
  const roleGrants = new FakeVendorRoleGrantRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new RegisterVendorUseCase(vendors, roleGrants, auditLogger);

  return { useCase, vendors, roleGrants, auditLogger };
}

describe('RegisterVendorUseCase', () => {
  it('creates a vendor in pending status owned by the caller', async () => {
    const { useCase, vendors } = buildUseCase();

    const result = await useCase.execute({
      ownerUserId: 'user-1',
      businessName: 'Green Leaf Organics',
      description: 'Locally grown vegetables.',
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('pending');
    expect(result.ownerUserId).toBe('user-1');
    expect(result.businessName).toBe('Green Leaf Organics');
    expect(result.verifiedAt).toBeNull();
    expect(vendors.all).toHaveLength(1);
  });

  it('grants the caller a vendor_owner role scoped to the new vendor', async () => {
    const { useCase, roleGrants } = buildUseCase();

    const result = await useCase.execute({
      ownerUserId: 'user-1',
      businessName: 'Green Leaf Organics',
      description: null,
      ipAddress: null,
    });

    expect(roleGrants.grants).toHaveLength(1);
    expect(roleGrants.grants[0]).toEqual({
      userId: 'user-1',
      vendorId: result.id,
    });
  });

  it('records a vendor.registered audit event', async () => {
    const { useCase, auditLogger } = buildUseCase();

    await useCase.execute({
      ownerUserId: 'user-1',
      businessName: 'Green Leaf Organics',
      description: null,
      ipAddress: '127.0.0.1',
    });

    expect(auditLogger.events.map((e) => e.action)).toContain(
      'vendor.registered',
    );
  });

  it('throws VendorAlreadyExistsError if the user already owns a vendor', async () => {
    const { useCase } = buildUseCase();

    await useCase.execute({
      ownerUserId: 'user-1',
      businessName: 'Green Leaf Organics',
      description: null,
      ipAddress: null,
    });

    await expect(
      useCase.execute({
        ownerUserId: 'user-1',
        businessName: 'Second Store',
        description: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(VendorAlreadyExistsError);
  });
});
