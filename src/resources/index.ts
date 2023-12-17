import { Client } from 'client';

export class APIResource {
  protected _client: Client;

  constructor(client: Client) {
    this._client = client;
  }
}
