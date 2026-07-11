import { randomUUID } from 'node:crypto';
import { RegisterProductUseCase } from '../register-product.use-case';
import { Category } from '../../../domain/entities/category.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import { InMemoryCategoryRepository } from '../../__tests__/fakes/in-memory-category.repository';
import {
  FakeAuditLogger,
  FakeVendorDocumentLookupRepository,
  FakeVendorLookupRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  CategoryNotFoundError,
  OrganicClaimUnverifiedError,
  ProductForbiddenError,
} from '../../../domain/errors/product.errors';

function buildUseCase() {
  const products = new InMemoryProductRepository();
  const categories = new InMemoryCategoryRepository();
  const vendorLookup = new FakeVendorLookupRepository();
  const vendorDocumentLookup = new FakeVendorDocumentLookupRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new RegisterProductUseCase(
    products,
    categories,
    vendorLookup,
    vendorDocumentLookup,
    auditLogger,
  );

  return {
    useCase,
    products,
    categories,
    vendorLookup,
    vendorDocumentLookup,
    auditLogger,
  };
}

async function seedCategory(categories: InMemoryCategoryRepository) {
  const category = Category.create({
    id: randomUUID(),
    parentId: null,
    name: 'Groceries',
    slug: 'groceries',
    taxRateBps: 500,
    now: new Date(),
  });
  await categories.save(category);
  return category;
}

describe('RegisterProductUseCase', () => {
  it('creates a draft product for a non-organic listing without needing a document', async () => {
    const { useCase, categories, vendorLookup, products } = buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });

    const result = await useCase.execute({
      userId: 'owner-1',
      categoryId: category.id,
      brandId: null,
      title: 'Basmati Rice 1kg',
      description: null,
      isOrganicClaim: false,
      organicCertDocumentId: null,
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('draft');
    expect(result.isOrganicClaim).toBe(false);
    expect(products.all).toHaveLength(1);
  });

  it('rejects an organic claim with no organicCertDocumentId (ORGANIC_CLAIM_UNVERIFIED)', async () => {
    const { useCase, categories, vendorLookup } = buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        categoryId: category.id,
        brandId: null,
        title: 'Organic Basmati Rice 1kg',
        description: null,
        isOrganicClaim: true,
        organicCertDocumentId: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrganicClaimUnverifiedError);
  });

  it('rejects an organic claim referencing a pending (not yet approved) document', async () => {
    const { useCase, categories, vendorLookup, vendorDocumentLookup } =
      buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });
    const documentId = randomUUID();
    vendorDocumentLookup.seed({
      id: documentId,
      vendorId: 'vendor-1',
      type: 'organic_certificate',
      reviewStatus: 'pending',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        categoryId: category.id,
        brandId: null,
        title: 'Organic Basmati Rice 1kg',
        description: null,
        isOrganicClaim: true,
        organicCertDocumentId: documentId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrganicClaimUnverifiedError);
  });

  it('rejects an organic claim referencing a document owned by another vendor', async () => {
    const { useCase, categories, vendorLookup, vendorDocumentLookup } =
      buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });
    const documentId = randomUUID();
    vendorDocumentLookup.seed({
      id: documentId,
      vendorId: 'some-other-vendor',
      type: 'organic_certificate',
      reviewStatus: 'approved',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        categoryId: category.id,
        brandId: null,
        title: 'Organic Basmati Rice 1kg',
        description: null,
        isOrganicClaim: true,
        organicCertDocumentId: documentId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrganicClaimUnverifiedError);
  });

  it('rejects an organic claim referencing a document of the wrong type', async () => {
    const { useCase, categories, vendorLookup, vendorDocumentLookup } =
      buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });
    const documentId = randomUUID();
    vendorDocumentLookup.seed({
      id: documentId,
      vendorId: 'vendor-1',
      type: 'business_registration',
      reviewStatus: 'approved',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        categoryId: category.id,
        brandId: null,
        title: 'Organic Basmati Rice 1kg',
        description: null,
        isOrganicClaim: true,
        organicCertDocumentId: documentId,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(OrganicClaimUnverifiedError);
  });

  it('creates a draft organic product when the document is approved and matches', async () => {
    const {
      useCase,
      categories,
      vendorLookup,
      vendorDocumentLookup,
      products,
      auditLogger,
    } = buildUseCase();
    const category = await seedCategory(categories);
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });
    const documentId = randomUUID();
    vendorDocumentLookup.seed({
      id: documentId,
      vendorId: 'vendor-1',
      type: 'organic_certificate',
      reviewStatus: 'approved',
    });

    const result = await useCase.execute({
      userId: 'owner-1',
      categoryId: category.id,
      brandId: null,
      title: 'Organic Basmati Rice 1kg',
      description: null,
      isOrganicClaim: true,
      organicCertDocumentId: documentId,
      ipAddress: '127.0.0.1',
    });

    expect(result.status).toBe('draft');
    expect(result.isOrganicClaim).toBe(true);
    expect(result.organicCertDocumentId).toBe(documentId);
    expect(products.all).toHaveLength(1);
    expect(auditLogger.events.map((e) => e.action)).toContain(
      'product.created',
    );
  });

  it('throws ProductForbiddenError when the caller has no vendor account', async () => {
    const { useCase, categories } = buildUseCase();
    const category = await seedCategory(categories);

    await expect(
      useCase.execute({
        userId: 'no-vendor-user',
        categoryId: category.id,
        brandId: null,
        title: 'Rice',
        description: null,
        isOrganicClaim: false,
        organicCertDocumentId: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(ProductForbiddenError);
  });

  it('throws CategoryNotFoundError for a nonexistent category', async () => {
    const { useCase, vendorLookup } = buildUseCase();
    vendorLookup.seed({
      id: 'vendor-1',
      ownerUserId: 'owner-1',
      status: 'pending',
    });

    await expect(
      useCase.execute({
        userId: 'owner-1',
        categoryId: randomUUID(),
        brandId: null,
        title: 'Rice',
        description: null,
        isOrganicClaim: false,
        organicCertDocumentId: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
  });
});
