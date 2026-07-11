import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Answer, type AnswerProps } from '../../domain/entities/answer.entity';
import {
  QUESTION_REPOSITORY,
  type QuestionRepository,
} from '../../domain/repositories/question.repository';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../domain/repositories/product.repository';
import {
  ANSWER_REPOSITORY,
  type AnswerRepository,
} from '../../domain/repositories/answer.repository';
import {
  AnswerForbiddenError,
  QuestionNotFoundError,
} from '../../domain/errors/product.errors';
import {
  AUDIT_LOGGER,
  type AuditLogger,
} from '../../../identity/application/ports/audit-logger.port';
import { USER_ROLES_REPOSITORY } from '../../../vendor/domain/repositories/user-roles.repository';
import type { UserRolesRepository } from '../../../vendor/domain/repositories/user-roles.repository';

export interface AnswerQuestionInput {
  userId: string;
  questionId: string;
  body: string;
  ipAddress: string | null;
}

export type AnswerQuestionResult = AnswerProps;

/**
 * POST /api/v1/catalog/questions/:id/answers — FR-PRD-004,
 * vendor_owner/vendor_staff of the OWNING vendor only. Ownership chain:
 * question -> product (Product's own repository) -> product.vendorId, then
 * a DB-backed role check (UserRolesRepository.hasRole, vendor-scoped) —
 * same "structural scoping via a DB-backed role lookup, not a route guard"
 * precedent as CreateProductVariantUseCase/RegisterProductUseCase using
 * VendorLookupRepository, except here the check is "does this user hold
 * vendor_owner OR vendor_staff scoped to THIS vendorId" rather than "does
 * this user own a vendor at all" — UserRolesRepository (imported from
 * Vendor's exported port, same as Product's other use cases already do)
 * is the right tool since it already supports vendor-scoped role checks
 * (see its doc comment: "True if the user has roleName... scoped to the
 * given vendorId"). A caller with neither role for this vendor gets 403
 * FORBIDDEN, not 422 — this is an authorization failure, not a business
 * rule violation (matches API Spec §1.4's FORBIDDEN definition).
 */
@Injectable()
export class AnswerQuestionUseCase {
  constructor(
    @Inject(QUESTION_REPOSITORY)
    private readonly questions: QuestionRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(ANSWER_REPOSITORY) private readonly answers: AnswerRepository,
    @Inject(USER_ROLES_REPOSITORY)
    private readonly userRoles: UserRolesRepository,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  async execute(input: AnswerQuestionInput): Promise<AnswerQuestionResult> {
    const question = await this.questions.findById(input.questionId);
    if (!question) {
      throw new QuestionNotFoundError();
    }

    const product = await this.products.findById(question.productId);
    if (!product) {
      // Product was hard-deleted or otherwise missing — treat as "no
      // owning vendor to authorize against", i.e. forbidden rather than
      // leaking an internal-consistency detail as 404.
      throw new AnswerForbiddenError();
    }

    const [isOwner, isStaff] = await Promise.all([
      this.userRoles.hasRole(input.userId, 'vendor_owner', product.vendorId),
      this.userRoles.hasRole(input.userId, 'vendor_staff', product.vendorId),
    ]);
    if (!isOwner && !isStaff) {
      throw new AnswerForbiddenError();
    }

    const now = new Date();
    const answer = Answer.create({
      id: randomUUID(),
      questionId: input.questionId,
      answeredBy: input.userId,
      body: input.body,
      now,
    });

    await this.answers.save(answer);

    await this.auditLogger.record({
      actorUserId: input.userId,
      action: 'question.answered',
      targetType: 'answer',
      targetId: answer.id,
      diff: { questionId: input.questionId },
      ipAddress: input.ipAddress,
    });

    return answer.snapshot;
  }
}
