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
  
      // Validate environment variable exists
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
            model: "gpt-4o-mini",
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
  
      // Generate image using Replicate
      const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-1.1-pro-ultra",
          input: {
            prompt: initialPrompt,
            aspect_ratio: "1:1",
            output_format: "jpg",
            safety_tolerance: 2,
          },
        }),
      });
  
      if (!replicateResponse.ok) {
        throw new Error(`Replicate API error: ${await replicateResponse.text()}`);
      }
  
      const prediction = await replicateResponse.json();
      
      // Poll for the result
      let attempts = 0;
      const maxAttempts = 30;
      let imageUrl;
  
      while (attempts < maxAttempts) {
        const resultResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${prediction.id}`,
          {
            headers: {
              "Authorization": `Token ${process.env.REPLICATE_API_TOKEN}`,
              "Content-Type": "application/json",
            },
          }
        );
  
        if (!resultResponse.ok) {
          throw new Error(`Failed to check prediction status: ${await resultResponse.text()}`);
        }
  
        const result = await resultResponse.json();
  
        if (result.status === "succeeded") {
          imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
          break;
        }
  
        if (result.status === "failed" || result.status === "canceled") {
          throw new Error(`Image generation ${result.status}`);
        }
  
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
  
      if (!imageUrl) {
        throw new Error("Timeout waiting for image generation");
      }
  
      return new Response(
        JSON.stringify({ url: imageUrl, prompt: initialPrompt }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
      
    } catch (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
  }