import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  fullName!: string | null;

  @ApiProperty({ nullable: true, type: String })
  avatarUrl!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date' })
  dateOfBirth!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  phoneVerifiedAt!: string | null;

  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  emailVerifiedAt!: string | null;
}
