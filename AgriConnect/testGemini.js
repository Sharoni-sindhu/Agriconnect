require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent("Say Hello from Gemini AI!");
    console.log("✅ Gemini AI Response:\n", result.response.text());
  } catch (err) {
    console.error("❌ Gemini AI Test Error:", err);
  }
}

testGemini();
