import jwt, { Secret, SignOptions } from "jsonwebtoken";
import "dotenv/config";

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET! as string;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET! as string;
const SECRET_KEY= process.env.SECRET_KEY! as string;
// const JWT_ACCESS_EXPIRY = Number(
//   process.env.JWT_ACCESS_EXPIRY || '1800' as string
// ) as number;
// const JWT_REFRESH_EXPIRY = Number(process.env.JWT_REFRESH_EXPIRY || '2592000') as number;

export interface JWTPayload {
  userId: string;
  email: string | null;
  user_type?: string;
}
export interface JWTPayloadAccount {
  userId?: string;
  email: string | null;
  user_type?: string;
  accountId?: string;
}

export const generateAccessToken = (payload: JWTPayload): string => {
  const options: SignOptions = { expiresIn: 1800 };
  // JWT_ACCESS_EXPIRY 
  return jwt.sign(payload, JWT_ACCESS_SECRET as Secret, options);
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  const options: SignOptions = { expiresIn: 2592000 };
  // JWT_REFRESH_EXPIRY 
  return jwt.sign(payload, JWT_REFRESH_SECRET as Secret, options);
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
};

export const generateTokens = (payload: JWTPayload) => {
  return {
    access: generateAccessToken(payload),
    refresh: generateRefreshToken(payload),
  };
};

export const generateAccessTokenAccount = (payload: JWTPayloadAccount): string => {
  const options: SignOptions = { expiresIn: 1800 };
  // JWT_ACCESS_EXPIRY 
  return jwt.sign(payload, JWT_ACCESS_SECRET as Secret, options);
};

export const generateRefreshTokenAccount = (payload: JWTPayloadAccount): string => {
  const options: SignOptions = { expiresIn: 2592000 };
  // JWT_REFRESH_EXPIRY 
  return jwt.sign(payload, JWT_REFRESH_SECRET as Secret, options);
};

export const verifyAccessTokenAccount = (token: string): JWTPayloadAccount => {
  return jwt.verify(token, JWT_ACCESS_SECRET) as JWTPayload;
};

export const verifyRefreshTokenAccount = (token: string): JWTPayloadAccount => {
  return jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;
};

export const generateTokensAccount = (payload: JWTPayloadAccount) => {
  return {
    access: generateAccessTokenAccount(payload),
    refresh: generateRefreshTokenAccount(payload),
  };
};
