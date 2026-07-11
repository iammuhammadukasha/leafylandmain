import { randomUUID } from 'node:crypto';
import { AnswerQuestionUseCase } from '../answer-question.use-case';
import { Product } from '../../../domain/entities/product.entity';
import { Question } from '../../../domain/entities/question.entity';
import { InMemoryProductRepository } from '../../__tests__/fakes/in-memory-product.repository';
import { InMemoryQuestionRepository } from '../../__tests__/fakes/in-memory-question.repository';
import { InMemoryAnswerRepository } from '../../__tests__/fakes/in-memory-answer.repository';
import {
  FakeAuditLogger,
  FakeUserRolesRepository,
} from '../../__tests__/fakes/fake-ports';
import {
  AnswerForbiddenError,
  QuestionNotFoundError,
} from '../../../domain/errors/product.errors';

function buildUseCase() {
  const questions = new InMemoryQuestionRepository();
  const products = new InMemoryProductRepository();
  const answers = new InMemoryAnswerRepository();
  const userRoles = new FakeUserRolesRepository();
  const auditLogger = new FakeAuditLogger();

  const useCase = new AnswerQuestionUseCase(
    questions,
    products,
    answers,
    userRoles,
    auditLogger,
  );

  return { useCase, questions, products, answers, userRoles, auditLogger };
}

async function seedProductAndQuestion(
  products: InMemoryProductRepository,
  questions: InMemoryQuestionRepository,
  vendorId: string,
): Promise<{ productId: string; questionId: string }> {
  const product = Product.create({
    id: randomUUID(),
    vendorId,
    categoryId: randomUUID(),
    brandId: null,
    title: 'Organic Tea',
    description: null,
    isOrganicClaim: false,
    organicCertDocumentId: null,
    now: new Date(),
  });
  await products.save(product);

  const question = Question.create({
    id: randomUUID(),
    productId: product.id,
    userId: 'asker-1',
    body: 'Is this caffeine-free?',
    now: new Date(),
  });
  await questions.save(question);

  return { productId: product.id, questionId: question.id };
}

describe('AnswerQuestionUseCase', () => {
  it('allows the owning vendor_owner to answer', async () => {
    const { useCase, products, questions, userRoles, answers } = buildUseCase();
    const vendorId = randomUUID();
    const { questionId } = await seedProductAndQuestion(
      products,
      questions,
      vendorId,
    );
    userRoles.grant('vendor-owner-1', 'vendor_owner', vendorId);

    const result = await useCase.execute({
      userId: 'vendor-owner-1',
      questionId,
      body: 'Yes, caffeine-free.',
      ipAddress: '127.0.0.1',
    });

    expect(result.body).toBe('Yes, caffeine-free.');
    expect(answers.all).toHaveLength(1);
  });

  it('allows vendor_staff of the owning vendor to answer', async () => {
    const { useCase, products, questions, userRoles } = buildUseCase();
    const vendorId = randomUUID();
    const { questionId } = await seedProductAndQuestion(
      products,
      questions,
      vendorId,
    );
    userRoles.grant('staff-1', 'vendor_staff', vendorId);

    const result = await useCase.execute({
      userId: 'staff-1',
      questionId,
      body: 'Confirmed caffeine-free.',
      ipAddress: null,
    });

    expect(result.answeredBy).toBe('staff-1');
  });

  it('rejects with AnswerForbiddenError when the caller is not the owning vendor (e.g. the asking shopper)', async () => {
    const { useCase, products, questions, userRoles } = buildUseCase();
    const vendorId = randomUUID();
    const { questionId } = await seedProductAndQuestion(
      products,
      questions,
      vendorId,
    );
    // Caller has no role grant at all for this vendor.
    userRoles.grant('asker-1', 'shopper');

    await expect(
      useCase.execute({
        userId: 'asker-1',
        questionId,
        body: 'trying to answer my own question',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(AnswerForbiddenError);
  });

  it('rejects with AnswerForbiddenError when the caller owns a DIFFERENT vendor', async () => {
    const { useCase, products, questions, userRoles } = buildUseCase();
    const vendorId = randomUUID();
    const otherVendorId = randomUUID();
    const { questionId } = await seedProductAndQuestion(
      products,
      questions,
      vendorId,
    );
    userRoles.grant('other-owner', 'vendor_owner', otherVendorId);

    await expect(
      useCase.execute({
        userId: 'other-owner',
        questionId,
        body: 'not my product',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(AnswerForbiddenError);
  });

  it('rejects with QuestionNotFoundError for a nonexistent question', async () => {
    const { useCase } = buildUseCase();

    await expect(
      useCase.execute({
        userId: 'vendor-owner-1',
        questionId: randomUUID(),
        body: 'no question',
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(QuestionNotFoundError);
  });
});
