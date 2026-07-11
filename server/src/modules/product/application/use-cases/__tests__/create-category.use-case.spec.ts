import { CreateCategoryUseCase } from '../create-category.use-case';
import { InMemoryCategoryRepository } from '../../__tests__/fakes/in-memory-category.repository';
import {
  FakeAuditLogger,
  FakeUserRolesRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  CategoryDepthExceededError,
  CategorySlugTakenError,
  ProductForbiddenError,
} from '../../../domain/errors/product.errors';

function buildUseCase() {
  const categories = new InMemoryCategoryRepository();
  const userRoles = new FakeUserRolesRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new CreateCategoryUseCase(categories, userRoles, auditLogger);

  return { useCase, categories, userRoles, auditLogger };
}

describe('CreateCategoryUseCase', () => {
  it('creates a root category as admin', async () => {
    const { useCase, userRoles } = buildUseCase();
    userRoles.grant('admin-1', 'admin');

    const result = await useCase.execute({
      actorUserId: 'admin-1',
      parentId: null,
      name: 'Groceries',
      slug: 'groceries',
      taxRateBps: 500,
      ipAddress: null,
    });

    expect(result.parentId).toBeNull();
    expect(result.slug).toBe('groceries');
  });

  it('throws ProductForbiddenError when the actor is not an admin', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        actorUserId: 'user-1',
        parentId: null,
        name: 'Groceries',
        slug: 'groceries',
        taxRateBps: 500,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductForbiddenError);
  });

  it('throws CategorySlugTakenError for a duplicate slug', async () => {
    const { useCase, userRoles } = buildUseCase();
    userRoles.grant('admin-1', 'admin');

    await useCase.execute({
      actorUserId: 'admin-1',
      parentId: null,
      name: 'Groceries',
      slug: 'groceries',
      taxRateBps: 500,
      ipAddress: null,
    });

    await expect(
      useCase.execute({
        actorUserId: 'admin-1',
        parentId: null,
        name: 'Groceries 2',
        slug: 'groceries',
        taxRateBps: 500,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(CategorySlugTakenError);
  });

  it('allows nesting up to depth 3 and rejects a 4th level', async () => {
    const { useCase, userRoles } = buildUseCase();
    userRoles.grant('admin-1', 'admin');

    const depth1 = await useCase.execute({
      actorUserId: 'admin-1',
      parentId: null,
      name: 'L1',
      slug: 'l1',
      taxRateBps: 0,
      ipAddress: null,
    });
    const depth2 = await useCase.execute({
      actorUserId: 'admin-1',
      parentId: depth1.id,
      name: 'L2',
      slug: 'l2',
      taxRateBps: 0,
      ipAddress: null,
    });
    const depth3 = await useCase.execute({
      actorUserId: 'admin-1',
      parentId: depth2.id,
      name: 'L3',
      slug: 'l3',
      taxRateBps: 0,
      ipAddress: null,
    });

    expect(depth3.parentId).toBe(depth2.id);

    await expect(
      useCase.execute({
        actorUserId: 'admin-1',
        parentId: depth3.id,
        name: 'L4',
        slug: 'l4',
        taxRateBps: 0,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(CategoryDepthExceededError);
  });
});
