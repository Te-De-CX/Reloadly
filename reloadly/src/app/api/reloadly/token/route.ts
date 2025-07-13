// app/api/reloadly/token/route.ts
import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST() {
  const RELOADLY_CLIENT_ID = process.env.RELOADLY_CLIENT_ID;
  const RELOADLY_CLIENT_SECRET = process.env.RELOADLY_CLIENT_SECRET;
  const TOKEN_URL = 'https://auth.reloadly.com/oauth/token';
  const AUDIENCE = process.env.RELOADLY_API_URL || (process.env.NODE_ENV === 'production' ? 'https://topups.reloadly.com' : 'https://topups-sandbox.reloadly.com');

  // Log environment variables for debugging (remove in production)
  console.log('Environment variables:', {
    RELOADLY_CLIENT_ID: RELOADLY_CLIENT_ID ? '[SET]' : '[UNSET]',
    RELOADLY_CLIENT_SECRET: RELOADLY_CLIENT_SECRET ? '[SET]' : '[UNSET]',
    TOKEN_URL,
    AUDIENCE,
  });

  if (!RELOADLY_CLIENT_ID || !RELOADLY_CLIENT_SECRET) {
    console.error('Missing API credentials');
    return NextResponse.json({ message: 'Missing API credentials' }, { status: 500 });
  }

  try {
    const payload = {
      client_id: RELOADLY_CLIENT_ID,
      client_secret: RELOADLY_CLIENT_SECRET,
      grant_type: 'client_credentials',
      audience: AUDIENCE,
    };
    console.log('Sending token request with payload:', {
      ...payload,
      client_id: '[REDACTED]',
      client_secret: '[REDACTED]',
    });

    const response = await axios.post(TOKEN_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    console.log('Token response:', {
      access_token: response.data.access_token ? '[REDACTED]' : '[UNSET]',
      expires_in: response.data.expires_in,
      token_type: response.data.token_type,
    });

    return NextResponse.json(response.data, { status: 200 });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error('Reloadly token fetch error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        headers: error.response?.headers,
      });
      return NextResponse.json(
        {
          message: error.response?.data?.message || 'Failed to fetch token',
          details: error.response?.data,
        },
        { status: error.response?.status || 500 }
      );
    }
    console.error('Unexpected error:', error);
    return NextResponse.json({ message: 'Failed to fetch token' }, { status: 500 });
  }
}