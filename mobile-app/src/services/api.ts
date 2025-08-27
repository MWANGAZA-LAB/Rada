import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WalletBalance } from '../hooks/useWallet';
import { ExchangeRate } from '../hooks/useExchangeRate';
import { Transaction } from '../hooks/useTransactions';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// Secure storage utilities
const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    console.error('Failed to retrieve auth token:', error);
    return null;
  }
};

const setAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (error) {
    console.error('Failed to store auth token:', error);
  }
};

const removeAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem('auth_token');
  } catch (error) {
    console.error('Failed to remove auth token:', error);
  }
};

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
  async (config) => {
    const token = await getAuthToken();
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
      await removeAuthToken();
      // Navigate to login screen (you'll need to implement this)
      // navigation.navigate('Login');
    }
    return Promise.reject(error);
  }
);

// API response types
interface ApiResponse<T> {
  status: 'success' | 'error';
  message: string;
  data: T;
  timestamp: string;
}

interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Error handling utility
const handleApiError = (error: any): never => {
  if (error.response?.data?.message) {
    throw new Error(error.response.data.message);
  } else if (error.message) {
    throw new Error(error.message);
  } else {
    throw new Error('An unexpected error occurred');
  }
};

export const walletApi = {
  getBalance: async (): Promise<WalletBalance> => {
    try {
      const { data } = await api.get<ApiResponse<WalletBalance>>('/wallet/balance');
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },
  
  getAddress: async (): Promise<string> => {
    try {
      const { data } = await api.get<ApiResponse<{ address: string }>>('/wallet/address');
      return data.data.address;
    } catch (error) {
      handleApiError(error);
    }
  },

  connectWallet: async (walletData: { walletType: string; lightningAddress: string }): Promise<void> => {
    try {
      await api.post<ApiResponse<void>>('/wallet/connect', walletData);
    } catch (error) {
      handleApiError(error);
    }
  }
};

export const exchangeApi = {
  getCurrentRate: async (): Promise<ExchangeRate> => {
    try {
      const { data } = await api.get<ApiResponse<ExchangeRate>>('/exchange/rate');
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};

export const transactionApi = {
  getTransactions: async (params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Transaction>> => {
    try {
      const { data } = await api.get<PaginatedResponse<Transaction>>('/transactions', { params });
      return data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getTransactionById: async (id: string): Promise<Transaction> => {
    try {
      const { data } = await api.get<ApiResponse<Transaction>>(`/transactions/${id}`);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  createTransaction: async (payload: {
    amount: number;
    recipientId: string;
    memo?: string;
  }): Promise<Transaction> => {
    try {
      const { data } = await api.post<ApiResponse<Transaction>>('/transactions', payload);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};

export const authApi = {
  login: async (phoneNumber: string): Promise<{ token: string; user: any }> => {
    try {
      const { data } = await api.post<ApiResponse<{ token: string; user: any }>>('/auth/login', { phoneNumber });
      await setAuthToken(data.data.token);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  register: async (userData: { phoneNumber: string; email?: string }): Promise<{ token: string; user: any }> => {
    try {
      const { data } = await api.post<ApiResponse<{ token: string; user: any }>>('/auth/register', userData);
      await setAuthToken(data.data.token);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  verifyOTP: async (phoneNumber: string, otp: string): Promise<{ token: string }> => {
    try {
      const { data } = await api.post<ApiResponse<{ token: string }>>('/auth/verify', { phoneNumber, otp });
      await setAuthToken(data.data.token);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      // Don't throw error on logout failure
      console.error('Logout error:', error);
    } finally {
      await removeAuthToken();
    }
  },

  refreshToken: async (): Promise<{ token: string }> => {
    try {
      const { data } = await api.post<ApiResponse<{ token: string }>>('/auth/refresh');
      await setAuthToken(data.data.token);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};

export const paymentApi = {
  initiatePayment: async (paymentData: {
    merchantId: string;
    amount: number;
    phone: string;
  }): Promise<{
    transactionId: string;
    checkoutRequestId: string;
    paymentRequest: string;
  }> => {
    try {
      const { data } = await api.post<ApiResponse<{
        transactionId: string;
        checkoutRequestId: string;
        paymentRequest: string;
      }>>('/payments/initiate', paymentData);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  },

  getPaymentStatus: async (transactionId: string): Promise<{ status: string; details?: any }> => {
    try {
      const { data } = await api.get<ApiResponse<{ status: string; details?: any }>>(`/payments/${transactionId}/status`);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};

export const merchantApi = {
  getMerchant: async (merchantId: string): Promise<any> => {
    try {
      const { data } = await api.get<ApiResponse<any>>(`/merchants/${merchantId}`);
      return data.data;
    } catch (error) {
      handleApiError(error);
    }
  }
};
