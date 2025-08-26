export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class MPESAError extends Error {
  public originalError: any;
  
  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'MPESAError';
    this.originalError = originalError;
  }
}

export class LightningError extends Error {
  public code: string;
  public originalError: any;

  constructor(message: string, code: string, originalError?: any) {
    super(message);
    this.name = 'LightningError';
    this.code = code;
    this.originalError = originalError;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class NetworkError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'NetworkError';
    this.statusCode = statusCode;
  }
}
