import openai from "../config/openai"

class MCQGenerator {
  static async generateMCQs(text, questionCount = 10, difficulty = "medium") {
    try {
      const prompt = `
You are an expert educator creating multiple-choice questions. Based on the following text, generate exactly ${questionCount} high-quality MCQ questions.

Requirements:
- Each question should test understanding, not just memorization
- Provide 4 options (A, B, C, D) where only one is correct
- Include a brief explanation for the correct answer
- Questions should be ${difficulty} difficulty level
- Cover different aspects of the content
- Avoid overly obvious or trick questions

Text to analyze:
${text.substring(0, 8000)} ${text.length > 8000 ? "...(truncated)" : ""}

Respond with a JSON object in this exact format:
{
  "questions": [
    {
      "question": "Question text here?",
      "option_a": "First option",
      "option_b": "Second option", 
      "option_c": "Third option",
      "option_d": "Fourth option",
      "correct_answer": "A",
      "explanation": "Brief explanation of why this answer is correct"
    }
  ]
}

Generate exactly ${questionCount} questions:`;

      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are an expert educator who creates high-quality multiple-choice questions. Always respond with valid JSON format.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      });

      const response = completion.choices[0].message.content;

      // Parse and validate JSON response
      let mcqData;
      try {
        mcqData = JSON.parse(response);
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        throw new Error("Invalid response format from AI");
      }

      // Validate structure
      if (!mcqData.questions || !Array.isArray(mcqData.questions)) {
        throw new Error("Invalid MCQ data structure");
      }

      // Validate each question
      const validQuestions = mcqData.questions.filter((q) => {
        return (
          q.question &&
          q.option_a &&
          q.option_b &&
          q.option_c &&
          q.option_d &&
          q.correct_answer &&
          ["A", "B", "C", "D"].includes(q.correct_answer) &&
          q.explanation
        );
      });

      if (validQuestions.length === 0) {
        throw new Error("No valid questions generated");
      }

      return {
        questions: validQuestions,
        generated_count: validQuestions.length,
        requested_count: questionCount,
      };
    } catch (error) {
      console.error("MCQ generation error:", error);
      throw new Error(`Failed to generate MCQs: ${error.message}`);
    }
  }
}

export default MCQGenerator;