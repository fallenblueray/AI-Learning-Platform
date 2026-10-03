import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsBoolean,
  IsObject,
  Matches,
} from 'class-validator';
export class RegisterDto {
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsString() @MinLength(12) @MaxLength(72) password!: string;
}
export class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MaxLength(72) password!: string;
  @IsOptional() @Matches(/^\d{6}$/) code?: string;
}
export class EmailDto {
  @IsEmail() email!: string;
}
export class TokenDto {
  @IsString() @MinLength(20) @MaxLength(200) token!: string;
}
export class ResetDto extends TokenDto {
  @IsString() @MinLength(12) @MaxLength(72) password!: string;
}
export class NameDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
}
export class TotpDto {
  @Matches(/^\d{6}$/) code!: string;
}
export class UnlockDto {
  @IsIn(['free', 'credits']) source!: 'free' | 'credits';
}
export class ProgressDto {
  @IsString() @MaxLength(64) lesson_id!: string;
  @IsInt() @Min(0) @Max(86400) position_seconds!: number;
  @IsBoolean() read!: boolean;
}
export class ExamDto {
  @IsObject() answers!: Record<string, number>;
}
export class CheckoutDto {
  @IsString() @MaxLength(64) pack_id!: string;
}
export class ReasonDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class PackDto {
  @IsString() @MinLength(1) @MaxLength(120) name!: string;
  @IsInt() @Min(1) @Max(100000) credits!: number;
  @IsInt() @Min(400) @Max(10000000) amount!: number;
  @IsBoolean() active!: boolean;
}
export class AssetDto {
  @IsString() @MaxLength(200) name!: string;
  @IsIn(['video/mp4', 'application/pdf', 'image/png', 'image/jpeg', 'text/vtt']) content_type!: string;
}
