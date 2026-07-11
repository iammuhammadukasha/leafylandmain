import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Category,
  type CategoryProps,
  MAX_CATEGORY_DEPTH,
} from '../../domain/entities/category.entity';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from '../../domain/repositories/category.repository';
import {
  USER_ROLES_REPOSITORY,
  type UserRolesRepository,
} from '../../../vendor/domain/repositories/user-roles.repository';
import {
  CategoryDepthExceededError,
  CategoryNotFoundError,
  CategorySlugTakenError,
  ProductForbiddenError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';

export interface CreateCategoryInput {
  actorUserId: string;
  parentId: string | null;
  name: string;
  slug: string;
  taxRateBps: number;
  ipAddress: string | null;
}

export type CreateCategoryResult = CategoryProps;

/**
 * POST /api/v1/catalog/categories — FR-PRD-001, admin only. Reuses
 * Vendor's UserRolesRepository port (imported from the Vendor module,
 * which exports it) for the admin role check — same DB-backed
 * authorization pattern as VerifyVendorUseCase, not a new mechanism.
 *
 * Enforces max depth 3 (Volume 04 §5 note: "max depth 3, enforced in app
 * layer") by walking the candidate parent's ancestor chain — a root
 * category (parentId null) is depth 1; a category whose parent is already
 * at depth 3 cannot be created.
 */
@Injectable()
export class CreateCategoryUseCase {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categories: CategoryRepository,
    @Inject(USER_ROLES_REPOSITORY)
    private readonly userRoles: UserRolesRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: CreateCategoryInput): Promise<CreateCategoryResult> {
    const isAdmin = await this.userRoles.hasRole(input.actorUserId, 'admin');
    if (!isAdmin) {
      throw new ProductForbiddenError('Only admins can create categories.');
    }

    const existingSlug = await this.categories.findBySlug(input.slug);
    if (existingSlug) {
      throw new CategorySlugTakenError();
    }

    let depth = 1;
    if (input.parentId !== null) {
      const all = await this.categories.findAll();
      const byId = new Map(all.map((c) => [c.id, c]));
      let current = byId.get(input.parentId);
      if (!current) {
        throw new CategoryNotFoundError();
      }
      depth = 2;
      while (current.parentId !== null) {
        depth += 1;
        current = byId.get(current.parentId);
        if (!current) break;
      }
      if (depth > MAX_CATEGORY_DEPTH) {
        throw new CategoryDepthExceededError();
      }
    }

    const now = new Date();
    const category = Category.create({
      id: randomUUID(),
      parentId: input.parentId,
      name: input.name,
      slug: input.slug,
      taxRateBps: input.taxRateBps,
      now,
    });

    await this.categories.save(category);

    await this.auditLogger.record({
      actorUserId: input.actorUserId,
      action: 'category.created',
      targetType: 'category',
      targetId: category.id,
      ipAddress: input.ipAddress,
    });

    return category.snapshot;
  }
}
