import {ChatWindowProps,ChatWindow} from 'Components/ChatBot/ChatWindow';
import {ClientOptions, Client} from "./client"
import * as Errors from './error';
import {APIResponseProps,Assistant,DISCUSSION,CHAT} from './types';


export {
  type ChatWindowProps,
  ChatWindow
}
export {
  Client
}
export {
  type ClientOptions,
  type APIResponseProps,
  type Assistant,
  type DISCUSSION,
  type CHAT
}
export const {
  AIChatError,
  APIError,
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  BadRequestError,
  AuthenticationError,
  InternalServerError,
  PermissionDeniedError,
  UnprocessableEntityError,
} = Errors;
