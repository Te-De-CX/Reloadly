import axios, { AxiosError } from 'axios';

// Configuration
const BASE_URL = process.env.RELOADLY_API_URL || (process.env.NODE_ENV === 'production' ? 'https://topups.reloadly.com' : 'https://topups-sandbox.reloadly.com');

let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let isFetchingToken = false;

// Type Definitions
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface CountryResponse {
  isoName: string;
  name: string;
  continent?: string;
  currencyCode?: string;
  currencyName?: string;
}

interface OperatorResponse {
  operatorId: number;
  name: string;
  countryCode: string;
}

interface DataPlanResponse {
  id: number;
  operatorId: number;
  operatorName: string;
  name: string;
  suggestedAmounts?: number[];
  fixedPrice?: number;
  currencyCode: string;
  dataAmount?: string;
  validity?: string;
}

interface BalanceResponse {
  balance: number;
  currencyCode: string;
}

interface TransactionResponse {
  transactionId: number;
  status: string;
}

interface ApiListResponse<T> {
  content?: T[];
  data?: T[];
  totalElements?: number;
  totalPages?: number;
  endpoint?: string;
  status?: number;
}

interface ApiError {
  message: string;
  path?: string;
  statusCode?: number;
  timeStamp?: string;
  details?: unknown;
}

// Removed redundant CountryInfo interface
// NetworkOperator interface removed as it was equivalent to OperatorResponse

export type CountryInfo = CountryResponse;
export type NetworkOperator = OperatorResponse;


export interface DataPlan {
  operatorId: number;
  operatorName: string;
  planId: number;
  planName: string;
  amount: number;
  currency: string;
  dataAmount: string;
  validity: string;
}

// Helper Functions
const getAccessToken = async (retries = 3, delayMs = 1000): Promise<string> => {
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    console.log('Using cached token');
    return accessToken;
  }

  if (isFetchingToken) {
    while (isFetchingToken) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken;
    }
  }

  isFetchingToken = true;
  try {
    console.log('Fetching token from /api/reloadly/token');
    const response = await axios.post<TokenResponse>(
      '/api/reloadly/token',
      {},
      { headers: { 'Content-Type': 'application/json' }, timeout: 10000 }
    );

    accessToken = response.data.access_token;
    tokenExpiry = Date.now() + response.data.expires_in * 1000 - 60000;
    console.log('Token fetched successfully:', {
      access_token: '[REDACTED]',
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });
    return accessToken;
  } catch (error) {
    const axiosError = error as AxiosError<ApiError>;
    console.error('Token fetch error:', {
      message: axiosError.message,
      response: axiosError.response?.data,
      status: axiosError.response?.status,
      headers: axiosError.response?.headers,
    });
    if (retries > 0 && axiosError.response?.status !== 401) {
      console.log(`Retrying token fetch, ${retries} attempts left`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return getAccessToken(retries - 1, delayMs);
    }
    throw new Error(axiosError.response?.data?.message || 'Authentication failed');
  } finally {
    isFetchingToken = false;
  }
};

const makeRequest = async <T, D = unknown>(method: 'get' | 'post', endpoint: string, data?: D): Promise<T> => {
  try {
    const token = await getAccessToken();
    console.log('Making API request:', { method, endpoint, token: '[REDACTED]' });
    const response = await axios<T>({
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/com.reloadly.topups-v1+json',
      },
      data,
      timeout: 10000,
    });

    console.log('API response:', { endpoint, status: response.status, data: response.data });
    return response.data;
  } catch (error) {
    const axiosError = error as AxiosError<ApiError>;
    console.error('API request error:', {
      endpoint,
      message: axiosError.message,
      response: axiosError.response?.data,
      status: axiosError.response?.status,
      headers: axiosError.response?.headers,
    });
    if (axiosError.response?.status === 401) {
      accessToken = null;
    }
    throw new Error(axiosError.response?.data?.message || 'API request failed');
  }
};

// API Methods
export const getCountries = async (): Promise<ApiListResponse<CountryResponse>> => {
  const response = await makeRequest<ApiListResponse<CountryResponse>>('get', '/countries');
  console.log('getCountries response:', response);
  const countries = response.data || response.content || [];
  if (!Array.isArray(countries)) {
    throw new Error('Invalid countries response format');
  }
  return response; // ✅ Now matches return type
};

export const getOperators = async (countryCode: string): Promise<ApiListResponse<OperatorResponse>> => {
  const response = await makeRequest<ApiListResponse<OperatorResponse>>(
    'get',
    `/operators/countries/${countryCode}`
  );
  console.log('getOperators response:', response);
  const operators = response.data || response.content || [];
  if (!Array.isArray(operators)) {
    throw new Error('Invalid operators response format');
  }
  console.log('getOperators: Returning operators:', operators);
  return response;
};

export const getDataPlans = async (operatorId: number): Promise<DataPlan[]> => {
  const response = await makeRequest<ApiListResponse<DataPlanResponse>>(
    'get',
    `/operators/${operatorId}/data-plans`
  );
  console.log('getDataPlans response:', response);
  return (response.content || response.data || []).map(plan => ({
    operatorId: plan.operatorId,
    operatorName: plan.operatorName,
    planId: plan.id,
    planName: plan.name,
    amount: plan.suggestedAmounts?.[0] ?? plan.fixedPrice ?? 0,
    currency: plan.currencyCode,
    dataAmount: plan.dataAmount ?? 'Unknown',
    validity: plan.validity ?? 'Unknown',
  }));
};

export const purchaseData = async (
  phoneNumber: string,
  operatorId: number,
  amount: number
): Promise<TransactionResponse> => {
  return makeRequest<TransactionResponse>('post', '/topups', {
    operatorId,
    amount,
    recipientPhone: {
      countryCode: 'NG',
      number: phoneNumber,
    },
  });
};

export const checkBalance = async (): Promise<number> => {
  const response = await makeRequest<BalanceResponse>('get', '/accounts/balance');
  return response.balance;
};