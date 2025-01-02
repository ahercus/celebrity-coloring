// api/generate.js

export const config = {};

export default async function handler(req) {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        {
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
    try {
        const { prompt } = await req.json();
        return new Response(
            JSON.stringify({ prompt }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    }
    catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}