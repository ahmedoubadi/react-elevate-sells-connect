import { MultipartBody } from './_shims/MultipartBody';

export const isMultipartBody = (body: any): body is MultipartBody =>
  body &&
  typeof body === 'object' &&
  body.body &&
  body[Symbol.toStringTag] === 'MultipartBody';
