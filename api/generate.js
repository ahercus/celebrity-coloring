// api/generate.js
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
      }
    );
  }

  try {
    const { prompt, name } = await req.json();

    // Validate environment variables
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    if (!process.env.REPLICATE_API_TOKEN) {
      throw new Error('Replicate API token not configured');
    }

    let initialPrompt;
    if (name) {
      // Generate prompt using OpenAI
      const promptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4",
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
          temperature: 0.7,
          max_tokens: 500
        }),
      });

      if (!promptResponse.ok) {
        throw new Error(`OpenAI API error: ${await promptResponse.text()}`);
      }

      const promptData = await promptResponse.json();
      initialPrompt = promptData.choices[0].message.content;

      if (initialPrompt === "INAPPROPRIATE_CONTENT") {
        throw new Error("INAPPROPRIATE_CONTENT");
      }
    } else {
      initialPrompt = prompt;
    }

    // Generate image using Replicate with correct API structure
    const replicateResponse = await fetch(
      "https://api.replicate.com/v1/models/black-forest-labs/flux-1.1-pro-ultra/predictions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Prefer": "wait"
        },
        body: JSON.stringify({
          input: {
            raw: false,
            prompt: initialPrompt,
            aspect_ratio: "1:1",
            output_format: "jpg",
            safety_tolerance: 2,
            image_prompt_strength: 0.1
          }
        }),
      }
    );

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text();
      throw new Error(`Replicate API error: ${errorText}`);
    }

    const result = await replicateResponse.json();
    
    // With 'Prefer: wait' header, the result should be immediately available
    const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;

    if (!imageUrl) {
      throw new Error('No image URL in response');
    }

    return new Response(
      JSON.stringify({ url: imageUrl, prompt: initialPrompt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}