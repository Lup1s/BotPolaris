import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function run() {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
        const data = await response.json();
        console.log("Modelos Disponíveis:");
        data.models.forEach(m => console.log(m.name, '-', m.supportedGenerationMethods));
    } catch (e) {
        console.error(e);
    }
}
run();