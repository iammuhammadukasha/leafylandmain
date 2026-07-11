// Pure domain entity — no NestJS decorators, no Prisma types (Architecture
// Volume 03 §4). Represents a row of `answers` (FR-PRD-004 Q&A — see
// schema.prisma's header comment above the Answer model for the design
// decision on this table's shape).

export interface AnswerProps {
  id: string;
  questionId: string;
  answeredBy: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  version: number;
}

export class Answer {
  private constructor(private props: AnswerProps) {}

  static reconstitute(props: AnswerProps): Answer {
    return new Answer(props);
  }

  /** Factory for a new answer (FR-PRD-004 — "vendor can answer"). The
   * caller (AnswerQuestionUseCase) has already verified the answering user
   * is vendor_owner/vendor_staff of the vendor that owns the question's
   * product BEFORE this factory runs — that check needs cross-context
   * reads (question -> product -> vendor, plus a role lookup), which is an
   * application-layer concern. */
  static create(params: {
    id: string;
    questionId: string;
    answeredBy: string;
    body: string;
    now: Date;
  }): Answer {
    return new Answer({
      id: params.id,
      questionId: params.questionId,
      answeredBy: params.answeredBy,
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

  get questionId(): string {
    return this.props.questionId;
  }

  get snapshot(): Readonly<AnswerProps> {
    return { ...this.props };
  }
}
