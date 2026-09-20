import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.member.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Member email already exists');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(dto.password, salt);

    const member = await this.prisma.member.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isAdmin: dto.isAdmin ?? false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        createdAt: true,
      },
    });

    const tokens = this.generateTokens(member.id, member.email, member.isAdmin);
    return { ...tokens, user: member };
  }

  async login(dto: LoginDto) {
    const member = await this.prisma.member.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        memberships: true,
      },
    });

    if (!member) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!member.isActive) {
      throw new UnauthorizedException('Account has been deactivated. Please contact an admin.');
    }

    const isMatch = await bcrypt.compare(dto.password, member.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = this.generateTokens(member.id, member.email, member.isAdmin);

    const { passwordHash, ...userWithoutPassword } = member;
    return {
      ...tokens,
      user: userWithoutPassword,
    };
  }

  async refreshToken(refreshTokenStr: string) {
    try {
      const payload = this.jwtService.verify(refreshTokenStr, {
        secret: process.env.JWT_REFRESH_SECRET || 'bunkr_refresh_secret_key_2026',
      });

      const member = await this.prisma.member.findUnique({
        where: { id: payload.sub },
      });

      if (!member) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      return this.generateTokens(member.id, member.email, member.isAdmin);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async getProfile(userId: string) {
    const member = await this.prisma.member.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            bed: {
              include: { room: true },
            },
          },
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('Member not found');
    }

    const { passwordHash, ...userWithoutPassword } = member;
    return userWithoutPassword;
  }

  private generateTokens(userId: string, email: string, isAdmin: boolean) {
    const payload = { sub: userId, email, isAdmin };

    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_SECRET || 'bunkr_secret_key_2026',
      expiresIn: '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET || 'bunkr_refresh_secret_key_2026',
      expiresIn: '30d',
    });

    return { accessToken, refreshToken };
  }
}
