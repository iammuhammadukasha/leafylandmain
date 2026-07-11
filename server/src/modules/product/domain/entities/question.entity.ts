// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `questions` (FR-PRD-004 Q&A — schema
// not detailed in Volume 04 §5, designed pragmatically for this slice, see
// schema.prisma's header comment above the Question model).

export interface QuestionProps {
  id: string;
  productId: string;
  userId: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Question {
  private constructor(private props: QuestionProps) {}

  static reconstitute(props: QuestionProps): Question {
    return new Question(props);
  }

  /** Factory for a new question (FR-PRD-004 — "Q&A is open to any
   * authenticated user"). No purchase/eligibility gate, unlike Review. */
  static create(params: {
    id: string;
    productId: string;
    userId: string;
    body: string;
    now: Date;
  }): Question {
    return new Question({
      id: params.id,
      productId: params.productId,
      userId: params.userId,
      body: params.body,
      createdAt: params.now,
      updatedAt: params.now,
      deletedAt: null,
      version: 1,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get productId(): string {
    return this.props.productId;
  }

  get snapshot(): Readonly<QuestionProps> {
    return { ...this.props };
  }
}
