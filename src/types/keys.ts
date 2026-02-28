export interface ProviderKey {
  name: string;
  provider: string;
  scope?: string;
}

export interface CreateKeyRequest {
  name: string;
  provider: string;
  token: string;
  scope?: string;
}

export interface KeyVerifyResult {
  name: string;
  provider: string;
  valid: boolean;
  username?: string;
  email?: string;
  scopes?: string;
  error?: string;
}
