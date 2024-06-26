import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GoogleUser, formatedResponse, numberCreditUse } from '../utils';
import { encodePassword } from '../utils/bcrypt';
import { SuccessRegister } from '../utils/message';
import { CreateUserDto, QueryTypeUseDto, UpdateUserDto } from './dto/index.dto';
import { UserDocument } from './model/user.model';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User')
    private readonly UserModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
  ) {}

  async getDetailUser(user: any) {
    delete user.password;
    delete user.isVerified;
    return {
      data: formatedResponse(user),
    };
  }

  async findUserByEmail(email: string) {
    return await this.UserModel.findOne({ email, isVerified: true }).lean();
  }

  async findUserByEmailNotActive(email: string) {
    return await this.UserModel.findOne({ email, isVerified: false });
  }

  async createUser(createUserDto: CreateUserDto) {
    const user = await this.UserModel.findOne({ email: createUserDto.email });
    const password = encodePassword(createUserDto.password);
    if (user) {
      await this.UserModel.updateOne(
        { email: createUserDto.email },
        {
          ...createUserDto,
          password,
        },
      );
    } else {
      await this.UserModel.create({ ...createUserDto, password, role: 'user' });
    }
    return {
      statusCode: HttpStatus.CREATED,
      message: SuccessRegister,
    };
  }

  async verifyUser(email: string) {
    await this.UserModel.updateOne({ email }, { isVerified: true });
    return {
      message: 'OK',
    };
  }

  async updateNewPassword(email: string, password: string) {
    const newPassword = encodePassword(password);
    await this.UserModel.updateOne({ email }, { password: newPassword });
    return {
      message: 'OK',
    };
  }

  async updateUserWhenPaymentSuccess(userId: string, price: any) {
    const userCurrent: any = await this.UserModel.findById(userId).lean();
    const creditsCurrent = userCurrent.credits || 0;
    await this.UserModel.updateOne(
      { _id: userId },
      { credits: creditsCurrent + Number(price?.metadata?.credits) },
    );
    return {
      message: 'OK',
    };
  }

  async useCredits(userId: string, query: QueryTypeUseDto) {
    const userCurrent: any = await this.UserModel.findById(userId).lean();
    const creditsCurrent = userCurrent.credits;
    if (creditsCurrent < numberCreditUse[query.type]) {
      throw new HttpException(
        'Your credits is not enable.',
        HttpStatus.BAD_REQUEST,
      );
    } else {
      await this.UserModel.updateOne(
        { _id: userId },
        { credits: creditsCurrent - numberCreditUse[query.type] },
      );
      return {
        message: 'OK',
      };
    }
  }

  async loginWithOauth2(user: GoogleUser) {
    const userCurrent = await this.UserModel.findOne({ email: user.email });
    const token = this.jwtService.sign({ email: user.email });

    const refreshToken = this.jwtService.sign(
      { email: user.email },
      { expiresIn: '7d' },
    );

    // const password = generateRandomPassword();

    if (userCurrent && !userCurrent.isVerified) {
      await this.UserModel.updateOne(
        { email: user.email },
        {
          isVerified: true,
        },
        // { isVerified: true, avatar: user.picture },
      );
    }

    if (!userCurrent) {
      await this.UserModel.create({
        email: user.email,
        firstName: user.firstName,
        // password: encodePassword(password),
        ...(user.lastName ? { lastName: user.lastName } : ''),
        // lastName: user.lastName || '',
        avatar: user.picture,
        isVerified: true,
      });
    }

    return {
      accessToken: token,
      refreshToken,
      // password,
      // email: user.email,
    };
  }

  async updateUser(userId: string, body: UpdateUserDto) {
    await this.UserModel.updateOne({ _id: userId }, body);

    return {
      message: 'OK',
    };
  }
}
