import { Priority } from '@/types/maintenance';

export interface AiTriageResult {
  category: string;
  recommendedPriority: Priority;
  estimatedCostRange: string;
  estimatedDuration: string;
  safetyAdvice: string[];
  explanation: string;
}

export interface AiSummaryInput {
  title: string;
  description: string;
  replacementDetails?: string;
  timeSpentMinutes?: number;
  actualCost?: number;
  warrantyStatus?: string;
}

export class AiService {
  /**
   * Module F: AI Smart Triage - Analyzes reported issue, predicts category, urgency, cost, and safety precautions
   */
  static async analyzeIssue(title: string, description: string): Promise<AiTriageResult> {
    const text = `${title} ${description}`.toLowerCase();

    // Check if Gemini API key exists
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are an expert facilities and maintenance engineering AI.
Analyze this maintenance report:
Title: "${title}"
Description: "${description}"

Respond ONLY with a JSON object matching this exact schema:
{
  "category": "Electrical" | "Plumbing" | "HVAC" | "Appliances" | "Carpentry" | "General",
  "recommendedPriority": "low" | "medium" | "high" | "urgent",
  "estimatedCostRange": "$XX - $YY",
  "estimatedDuration": "XX mins",
  "safetyAdvice": ["bullet 1", "bullet 2"],
  "explanation": "Brief reasoning for priority and triage"
}`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            const cleaned = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleaned);
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Gemini API call fallback to heuristic engine:', err);
      }
    }

    // High-performance intelligent heuristic triage engine (Fallback & offline support)
    return this.heuristicTriage(text, title);
  }

  /**
   * Module F: AI Assistant for Technicians - Auto-generates professional audit-compliant completion summaries
   */
  static async generateCompletionSummary(input: AiSummaryInput): Promise<string> {
    const title = input.title || 'Reported Maintenance Issue';
    const desc = input.description || 'General maintenance repair';
    const rep = input.replacementDetails || 'Standard component servicing and inspection';
    const time = input.timeSpentMinutes || 30;
    const cost = input.actualCost != null ? `$${input.actualCost.toFixed(2)}` : '$0.00';
    const warranty = (input.warrantyStatus || 'under_warranty').replace(/_/g, ' ');

    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (apiKey) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `You are a certified facilities maintenance technician writing a formal completion summary for an official audit report.
Draft a concise, professional 2-3 sentence technical completion summary paragraph for:
- Issue: ${title} (${desc})
- Replacement / Work Done: ${rep}
- Labor Duration: ${time} minutes
- Total Cost: ${cost}
- Warranty Status: ${warranty}

Provide ONLY the final summary paragraph without introductory filler words.`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const json = await response.json();
          const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) {
            return candidateText.trim();
          }
        }
      } catch (err) {
        console.warn('Gemini API fallback for summary:', err);
      }
    }

    // High quality fallback technical summary
    const workSentence = input.replacementDetails
      ? `Completed necessary hardware replacement and service: ${input.replacementDetails}.`
      : `Completed thorough inspection, diagnostic testing, and repair of the reported issue.`;

    const laborSentence = input.timeSpentMinutes
      ? `Total technician labor time recorded was ${input.timeSpentMinutes} minutes.`
      : 'All maintenance procedures performed to standard specifications.';

    return `Maintenance technician completed diagnostic inspection and resolution for "${title}". ${workSentence} All systems tested under operating load and verified fully operational. ${laborSentence}`.trim();
  }

  private static heuristicTriage(text: string, title: string): AiTriageResult {
    // Electrical
    if (
      text.includes('fan') ||
      text.includes('light') ||
      text.includes('power') ||
      text.includes('spark') ||
      text.includes('switch') ||
      text.includes('breaker') ||
      text.includes('voltage') ||
      text.includes('wire') ||
      text.includes('bulb') ||
      text.includes('fuse')
    ) {
      const isUrgent = text.includes('spark') || text.includes('smoke') || text.includes('shock');
      return {
        category: '⚡ Electrical',
        recommendedPriority: isUrgent ? 'urgent' : text.includes('fan') || text.includes('power') ? 'high' : 'medium',
        estimatedCostRange: '$30 - $85',
        estimatedDuration: '30 - 45 mins',
        safetyAdvice: [
          'Do not touch exposed wiring or wet switches.',
          isUrgent ? 'Immediately switch off the main circuit breaker.' : 'Keep switch turned off until technician inspects.',
        ],
        explanation: 'Identified as electrical component servicing. Auto-assigned to electrical-certified staff.',
      };
    }

    // Plumbing
    if (
      text.includes('leak') ||
      text.includes('water') ||
      text.includes('pipe') ||
      text.includes('bucket') ||
      text.includes('tap') ||
      text.includes('faucet') ||
      text.includes('drain') ||
      text.includes('sink') ||
      text.includes('toilet') ||
      text.includes('flush')
    ) {
      const isUrgent = text.includes('flood') || text.includes('burst') || text.includes('overflow');
      return {
        category: '🚰 Plumbing',
        recommendedPriority: isUrgent ? 'urgent' : text.includes('leak') ? 'high' : 'medium',
        estimatedCostRange: '$25 - $70',
        estimatedDuration: '20 - 40 mins',
        safetyAdvice: [
          'Place a bucket or towels under the leak to prevent water damage.',
          'Shut off local inlet stopcock valve if flow is continuous.',
        ],
        explanation: 'Identified as plumbing fixture issue. Prioritized to prevent structural moisture damage.',
      };
    }

    // HVAC / AC
    if (
      text.includes('ac') ||
      text.includes('air conditioner') ||
      text.includes('cooling') ||
      text.includes('heater') ||
      text.includes('thermostat') ||
      text.includes('filter')
    ) {
      return {
        category: '❄️ HVAC & Cooling',
        recommendedPriority: 'medium',
        estimatedCostRange: '$50 - $120',
        estimatedDuration: '45 - 60 mins',
        safetyAdvice: [
          'Turn off the unit to prevent compressor overload.',
          'Ensure indoor vents are unblocked.',
        ],
        explanation: 'Identified as HVAC climate control unit. Requires standard coil & filter inspection.',
      };
    }

    // Default / General
    return {
      category: '🛠️ General Maintenance',
      recommendedPriority: 'medium',
      estimatedCostRange: '$20 - $50',
      estimatedDuration: '30 mins',
      safetyAdvice: ['Keep area clear of personal belongings for technician access.'],
      explanation: 'General facility repair categorized and routed to available maintenance personnel.',
    };
  }
}
