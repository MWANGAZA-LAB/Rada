import axios from 'axios';
import { WalletBalance } from '../hooks/useWallet';
import { ExchangeRate } from '../hooks/useExchangeRate';
import { Transaction } from '../hooks/useTransactions';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Handle token expiration
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const walletApi = {
  getBalance: async (): Promise<WalletBalance> => {
    const { data } = await api.get('/wallet/balance');
    return data;
  },
  
  getAddress: async (): Promise<string> => {
    const { data } = await api.get('/wallet/address');
    return data.address;
  }
};

export const exchangeApi = {
  getCurrentRate: async (): Promise<ExchangeRate> => {
    const { data } = await api.get('/exchange/rate');
    return data;
  }
};

export const transactionApi = {
  getTransactions: async (): Promise<Transaction[]> => {
    const { data } = await api.get('/transactions');
    return data;
  },

  getTransactionById: async (id: string): Promise<Transaction> => {
    const { data } = await api.get(`/transactions/${id}`);
    return data;
  },

  createTransaction: async (payload: {
    amount: number;
    recipientId: string;
    memo?: string;
  }): Promise<Transaction> => {
    const { data } = await api.post('/transactions', payload);
    return data;
  }
};

export const authApi = {
  login: async (phoneNumber: string): Promise<{ token: string }> => {
    const { data } = await api.post('/auth/login', { phoneNumber });
    return data;
  },

  verifyOTP: async (phoneNumber: string, otp: string): Promise<{ token: string }> => {
    const { data } = await api.post('/auth/verify', { phoneNumber, otp });
    return data;
  }
};
