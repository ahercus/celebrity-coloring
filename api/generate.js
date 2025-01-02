// api/generate.js
import { OpenAI } from 'openai';
import Replicate from 'replicate';
import 'dotenv/config';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
    if (req.method !== 'POST') {
        return new Response(
            JSON.stringify({ error: 'Method not allowed' }),
            {
                status: 405,
                headers: { 'Content-Type': 'application/json' },
            },
        );
    }

    try {
        const { name, regenerate, originalPrompt } = await req.json();

        if (!process.env.OPENAI_API_KEY || !process.env.REPLICATE_API_TOKEN) {
            throw new Error('OpenAI or Replicate API keys not configured');
        }
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
        const replicate = new Replicate({
            auth: process.env.REPLICATE_API_TOKEN,
        });

        const prompt = regenerate
            ? originalPrompt
            : await generateInitialPrompt(name, openai);

        const imageUrl = await generateWithReplicate(prompt, replicate);

        return new Response(
            JSON.stringify({ url: imageUrl, prompt: prompt }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
        );
    }
}
async function generateInitialPrompt(name, openai) {
    try {
        const promptResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert at creating image generation prompts. Focus on creating black and white, line-art style coloring book pages.

If the request includes truly offensive content (does not include politicians, actors, or musicians), respond exactly with "INAPPROPRIATE_CONTENT". Otherwise, create a detailed prompt.`,
                },
                {
                    role: 'user',
                    content: `Create a descriptive prompt for a black and white children's coloring page featuring ${name}. The image should be line art style with clear outlines, no shading, suitable for coloring in. Include relevant background elements and props that tell a story about ${name}.`,
                },
            ],
        });

        const content = promptResponse.choices[0].message.content;
        if (content === "INAPPROPRIATE_CONTENT") {
            throw new Error("INAPPROPRIATE_CONTENT");
        }

        return content;
    } catch (error) {
        throw error;
    }
}
const generateWithReplicate = async (prompt, replicate) => {
    try {
        const prediction = await replicate.predictions.create({
            model: "black-forest-labs/flux-1.1-pro-ultra",
            input: {
                prompt: prompt,
                aspect_ratio: "1:1",
                output_format: "jpg",
                safety_tolerance: 2,
            },
        });

        let status = prediction.status;
        let predictionResult = prediction;
        let attempts = 0;
        const maxAttempts = 30;

        while (status !== "succeeded" && status !== "failed" && status !== "canceled" && attempts < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
                predictionResult = await replicate.predictions.get(prediction.id);
                status = predictionResult.status;
            } catch (pollError) {
                throw pollError;
            }
            attempts++;
        }

        if (status === "succeeded" && predictionResult.output) {
            let imageUrl;
            if (Array.isArray(predictionResult.output)) {
                imageUrl = predictionResult.output[0];
            } else if (typeof predictionResult.output === 'string') {
                imageUrl = predictionResult.output;
            }

            if (imageUrl && imageUrl.startsWith('http')) {
                return imageUrl;
            }
        }
        if (status === "failed" || status === "canceled") {
            throw new Error(`Failed to generate image. Status: ${status}`);
        }
    } catch (error) {
        throw error;
    }
};