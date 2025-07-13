// // libs/reloadlyService.ts
// import axios, { AxiosError } from 'axios';

// // Configuration
// const RELOADLY_CLIENT_ID = process.env.NEXT_PUBLIC_RELOADLY_CLIENT_ID;
// const RELOADLY_CLIENT_SECRET = process.env.NEXT_PUBLIC_RELOADLY_CLIENT_SECRET;
// const RELOADLY_ENV = process.env.NODE_ENV === 'production' ? 'live' : 'sandbox';
// const BASE_URL = `https://${RELOADLY_ENV}.reloadly.com`;

// let accessToken: string | null = null;
// let tokenExpiry: number | null = null;

// // Type Definitions
// export interface Country {
//   isoName: string;
//   name: string;
// }

// export interface Operator {
//   operatorId: number;
//   name: string;
//   countryCode: string;
// }

// export interface DataPlan {
//   operatorId: number;
//   operatorName: string;
//   planId: number;
//   planName: string;
//   amount: number;
//   currency: string;
//   dataAmount: string;
//   validity: string;
// }

// export interface Transaction {
//   transactionId: number;
//   status: string;
// }

// // Helper Functions
// const getAccessToken = async (): Promise<string> => {
//   if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
//     return accessToken;
//   }

//   try {
//     const response = await axios.post(`${BASE_URL}/oauth/token`, {
//       client_id: RELOADLY_CLIENT_ID,
//       client_secret: RELOADLY_CLIENT_SECRET,
//       grant_type: 'client_credentials',
//       audience: `https://${RELOADLY_ENV}.reloadly.com`
//     });

//     accessToken = response.data.access_token;
//     tokenExpiry = Date.now() + (response.data.expires_in * 1000);
//     return accessToken;
//   } catch (error) {
//     console.error('Failed to get access token:', error);
//     throw new Error('Authentication failed');
//   }
// };

// const makeRequest = async (method: 'get' | 'post', endpoint: string, data?: any) => {
//   try {
//     const token = await getAccessToken();
//     const response = await axios({
//       method,
//       url: `${BASE_URL}${endpoint}`,
//       headers: {
//         'Authorization': `Bearer ${token}`,
//         'Content-Type': 'application/json'
//       },
//       data
//     });
//     return response.data;
//   } catch (error) {
//     const axiosError = error as AxiosError;
//     console.error('API request failed:', {
//       endpoint,
//       status: axiosError.response?.status,
//       data: axiosError.response?.data
//     });
//     throw new Error(axiosError.response?.data?.message || 'Request failed');
//   }
// };

// // API Methods
// export const getCountries = async (): Promise<Country[]> => {
//   try {
//     const data = await makeRequest('get', '/countries');
//     return data.content;
//   } catch (error) {
//     console.error('Failed to get countries:', error);
//     throw new Error('Failed to load countries');
//   }
// };

// export const getOperators = async (countryCode: string): Promise<Operator[]> => {
//   try {
//     const data = await makeRequest('get', `/operators/countries/${countryCode}`);
//     return data.content;
//   } catch (error) {
//     console.error('Failed to get operators:', error);
//     throw new Error('Failed to load operators');
//   }
// };

// export const getDataPlans = async (operatorId: number): Promise<DataPlan[]> => {
//   try {
//     const data = await makeRequest('get', `/operators/${operatorId}/data-plans`);
//     return data.content.map((plan: any) => ({
//       operatorId: plan.operatorId,
//       operatorName: plan.operatorName,
//       planId: plan.id,
//       planName: plan.name,
//       amount: plan.suggestedAmounts?.[0] || plan.fixedPrice,
//       currency: plan.currencyCode,
//       dataAmount: plan.dataAmount || 'N/A',
//       validity: plan.validity || 'N/A'
//     }));
//   } catch (error) {
//     console.error('Failed to get data plans:', error);
//     throw new Error('Failed to load data plans');
//   }
// };

// export const purchaseData = async (
//   phoneNumber: string,
//   operatorId: number,
//   amount: number
// ): Promise<Transaction> => {
//   try {
//     const data = await makeRequest('post', '/topups', {
//       operatorId,
//       amount,
//       recipientPhone: {
//         countryCode: 'NG',
//         number: phoneNumber
//       }
//     });
//     return data;
//   } catch (error) {
//     console.error('Purchase failed:', error);
//     throw new Error('Purchase failed');
//   }
// };

// export const checkBalance = async (): Promise<number> => {
//   try {
//     const data = await makeRequest('get', '/accounts/balance');
//     return data.balance;
//   } catch (error) {
//     console.error('Failed to check balance:', error);
//     throw new Error('Failed to check balance');
//   }
// };