// import type { NextApiRequest, NextApiResponse } from 'next';
// import axios from 'axios';

// interface PurchaseRequest {
//   operatorId: number;
//   amount: number;
//   phone: string;
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   if (req.method !== 'POST') {
//     return res.status(405).json({ error: 'Method not allowed' });
//   }

//   const { operatorId, amount, phone } = req.body as PurchaseRequest;

//   try {
//     const response = await axios.post(
//       `${process.env.RELOADLY_API_URL}/topups`,
//       {
//         operatorId,
//         amount,
//         recipientPhone: { countryCode: 'NG', number: phone },
//       },
//       {
//         headers: {
//           Authorization: `Bearer ${await getAccessToken()}`,
//           'Content-Type': 'application/json',
//         },
//       }
//     );

//     res.status(200).json({
//       code: 'success',
//       message: 'Data successfully delivered',
//       data: response.data,
//     });
//   } catch (error: any) {
//     res.status(500).json({
//       code: 'failure',
//       message: error.response?.data?.message || 'Purchase failed',
//     });
//   }
// }

// async function getAccessToken() {
//   const response = await axios.post('https://auth.reloadly.com/oauth/token', {
//     client_id: process.env.RELOADLY_CLIENT_ID,
//     client_secret: process.env.RELOADLY_CLIENT_SECRET,
//     grant_type: 'client_credentials',
//     audience: 'https://topups.reloadly.com',
//   });
//   return response.data.access_token;
// }