import { OpenAI } from 'openai';
import Replicate from 'replicate';

    let currentCelebrity = '';
    let currentPrompt = '';
    const loaderContainer = document.createElement('div');
      loaderContainer.className = 'loader-container';
      loaderContainer.innerHTML = '<span class="loader"></span>';

    async function handleGeneration(regenerate = false) {
      const inputField      = document.querySelector('.celebrity-input');
      const generateButton  = document.querySelector('.generate-btn');
      const resultContainer = document.querySelector('#resultContainer');
      generateButton.disabled = true;
      generateButton.textContent = 'Generating...';
        resultContainer.style.position = 'relative';
        resultContainer.appendChild(loaderContainer);
      try {
        const requestBody = regenerate
          ? { 
              prompt: currentPrompt
            }
          : { 
              name: inputField.value.trim()
            };
        if (!regenerate && !requestBody.name) {
          throw new Error('Please enter a name!');
        }
          
        if (!regenerate) {
          currentCelebrity = requestBody.name;
        }
        const initialPrompt = regenerate
              ? requestBody.prompt
              : await generateInitialPrompt(requestBody.name);
          const imageUrl = await generateWithReplicate(initialPrompt);
          if (imageUrl) {
            currentPrompt = initialPrompt;
            displayResult(imageUrl);
          }
          else {
            throw new Error('No URL in response');
          }
      } catch (error) {
          console.error('Error:', error);
        const errorMessage = error.message || 'Failed to generate the image. Please try again.';
          const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.style.cssText = `
                color: #ff4757;
                background: #fff;
                padding: 2rem;
                text-align: center;
                font-size: 2.5rem;
                font-weight: bold;
                border: 8px solid #ff4757;
                border-radius: 30px;
                box-shadow: 
                    0 0 0 4px #fff,
                    0 0 0 8px #ffbe0b,
                    0 15px 25px -5px rgba(0,0,0,0.2),
                    0 30px 50px -12px rgba(0,0,0,0.3);
                transform: rotate(-2deg);
                animation: wobble 0.5s ease-in-out;
                margin: 2rem;
            `;
          const style = document.createElement('style');
            style.textContent = `
                @keyframes wobble {
                    0%, 100% { transform: rotate(-2deg); }
                    25% { transform: rotate(3deg) scale(1.1); }
                    50% { transform: rotate(-3deg); }
                    75% { transform: rotate(2deg) scale(1.1); }
                }
            `;
        document.head.appendChild(style);
          errorDiv.innerHTML = `
                <div style="font-size: 4rem; margin-bottom: 1rem">🚫 Bummer. 🚫</div>
                <div style="font-family: 'Comic Neue', cursive;">${errorMessage}</div>
                <div style="font-size: 3rem; margin-top: 1rem">✨ Try someone more chill ✨</div>
            `;
        resultContainer.innerHTML = '';
          resultContainer.appendChild(errorDiv);
      } finally {
        generateButton.disabled = false;
        generateButton.textContent = '✨ Generate! ✨';
          if (!regenerate) {
              inputField.disabled = false;
          }
        const loaderDiv = resultContainer.querySelector('.loader-container');
        if (loaderDiv) {
            loaderDiv.remove();
        }
      }
    }
    async function generateInitialPrompt(name) {
        try {
          const apiKey = import.meta.env.OPENAI_API_KEY;
          const openai = new OpenAI({ apiKey });
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
  const generateWithReplicate = async (prompt) => {
        try {
             const replicateToken = import.meta.env.REPLICATE_API_TOKEN;
             const replicate = new Replicate({
                auth: replicateToken,
              });
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
                   throw pollError
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
             throw error
        }
    };
    document.querySelector('.generate-btn').addEventListener('click', () => {
      handleGeneration(false);
    });
    document.querySelector('.celebrity-input').addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            document.querySelector('.generate-btn').click();
        }
    });
    function regenerateImage() {
      handleGeneration(true);
    }
    function displayResult(url) {
      const resultContainer = document.querySelector('#resultContainer');
      resultContainer.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = 'Generated Coloring Page';
      img.style.maxWidth = '100%';
      img.style.marginBottom = '20px';
      resultContainer.appendChild(img);
      const reactionDiv = document.createElement('div');
      reactionDiv.className = 'reaction-container';
      const saveIcon = document.getElementById('save-icon').outerHTML;
      const loopIcon = document.getElementById('loop-icon').outerHTML;
      reactionDiv.innerHTML = `
        <button class="reaction-btn save-btn" onclick="addToGallery('${url}')" title="Save to gallery">
          ${saveIcon}
        </button>
        <button class="print-btn" onclick="printPage('${url}')">PRINT</button>
        <button class="reaction-btn loop-btn" onclick="regenerateImage()" title="Generate new variation">
          ${loopIcon}
        </button>
      `;
      
      resultContainer.appendChild(reactionDiv);
    }
    function printPage(url) {
      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head><title>Print Coloring Page</title></head>
          <body style="margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh;">
            <img src="${url}" style="max-width: 100%; height: auto;">
            <script>
              window.onload = () => {
                window.print();
                window.close();
              };
            <\/script>
          </body>
        </html>
      `);
    }
    function addToGallery(url) {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Generated Coloring Page';
        img.style.maxWidth = '200px';
        img.style.margin = '10px';
        img.style.cursor = 'pointer';

      img.addEventListener('click', () => {
        displayResult(url);
      });
      document.querySelector('#gallery').appendChild(img);
    }