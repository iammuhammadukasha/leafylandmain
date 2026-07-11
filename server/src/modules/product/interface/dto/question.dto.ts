import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateQuestionDto {
  @ApiProperty({ example: 'Is this suitable for infants?' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class CreateAnswerDto {
  @ApiProperty({ example: 'Yes, suitable from 6 months onward.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}

export class QuestionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiProperty({ type: [Object] })
  answers!: AnswerResponseDto[];
}

export class AnswerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  questionId!: string;

  @ApiProperty()
  answeredBy!: string;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}
