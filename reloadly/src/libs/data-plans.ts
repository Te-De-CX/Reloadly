// import type { NextApiRequest, NextApiResponse } from 'next';
// import axios from 'axios';

// interface DataPlan {
//   operatorId: number;
//   name: string;
//   amount: number;
//   validity: string;
// }

// export default async function handler(req: NextApiRequest, res: NextApiResponse) {
//   try {
//     const { network } = req.query; // e.g., 'mtn', 'glo', 'airtel'
//     const response = await axios.get(
//       `${process.env.RELOADLY_API_URL}/operators?countryCode=NG`,
//       {
//         headers: {
//           Authorization: `Bearer ${await getAccessToken()}`,
//         },
//       }
//     );

//     const operators = response.data.filter((op: any) =>
//       network ? op.name.toLowerCase().includes(network as string) : true
//     );
//     const plans = operators.map((op: any) => ({
//       operatorId: op.operatorId,
//       name: op.name,
//       amount: op.fixedAmounts[0] || 0, // Adjust based on actual data plan response
//       validity: op.validity || 'Unknown',
//     }));

//     res.status(200).json(plans);
//   } catch (error) {
//     res.status(500).json({ error: 'Failed to fetch data plans' });
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