import { GoogleGenAI, Type } from '@google/genai';

export interface RoadInspectionResult {
  analyzedWithModel: string;
  isRoadSurface: boolean;
  potholeDetected: boolean;
  damageType: string;
  recommendedSeverity: 'Low' | 'Medium' | 'High';
  visualObservations: string[];
  assessmentNote: string;
  confidenceNote: string;
}

export async function analyzeRoadPhotograph(
  base64Data: string,
  mimeType: string
): Promise<RoadInspectionResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured in the server environment. Configure it in Settings > Secrets to run live Gemini Vision inspection.'
    );
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text:
            'Inspect this uploaded photograph for civic road maintenance triage. ' +
            'Determine whether it depicts a road/pavement surface and whether a pothole or road damage is visible. ' +
            'List concrete observable visual cues only based on what is actually in the photo. ' +
            'Do not invent measurements or probability scores.',
        },
      ],
    },
    config: {
      systemInstruction:
        'You are a civic infrastructure visual triage assistant. Classify road photographs accurately and conservatively. If the photo does not show a road or pothole, report that honestly.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          isRoadSurface: {
            type: Type.BOOLEAN,
            description: 'True if the photograph clearly shows a road, street, or asphalt/concrete pavement surface.',
          },
          potholeDetected: {
            type: Type.BOOLEAN,
            description: 'True if a pothole or significant pavement cavity/fracture hazard is visible.',
          },
          damageType: {
            type: Type.STRING,
            description: 'Short label such as Severe Pothole, Moderate Pothole / Cracking, Minor Surface Wear, Intact Road Surface, or Non-Road Image.',
          },
          recommendedSeverity: {
            type: Type.STRING,
            description: 'One of Low, Medium, or High based on visible hazard size and edge breakdown.',
          },
          visualObservations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '2 to 4 concise, factual visual observations directly visible in the image.',
          },
          assessmentNote: {
            type: Type.STRING,
            description: '1 to 2 sentence summary explaining the visual triage finding for a civic reviewer.',
          },
        },
        required: [
          'isRoadSurface',
          'potholeDetected',
          'damageType',
          'recommendedSeverity',
          'visualObservations',
          'assessmentNote',
        ],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as {
    isRoadSurface?: boolean;
    potholeDetected?: boolean;
    damageType?: string;
    recommendedSeverity?: string;
    visualObservations?: string[];
    assessmentNote?: string;
  };

  const sev =
    parsed.recommendedSeverity === 'High' ||
    parsed.recommendedSeverity === 'Medium' ||
    parsed.recommendedSeverity === 'Low'
      ? parsed.recommendedSeverity
      : 'Medium';

  return {
    analyzedWithModel: 'gemini-4-hydrogen',
    isRoadSurface: Boolean(parsed.isRoadSurface),
    potholeDetected: Boolean(parsed.potholeDetected),
    damageType: parsed.damageType || 'Visual Inspection Complete',
    recommendedSeverity: sev,
    visualObservations: Array.isArray(parsed.visualObservations)
      ? parsed.visualObservations.slice(0, 5)
      : [],
    assessmentNote: parsed.assessmentNote || 'Visual inspection completed.',
    confidenceNote:
      'Inspected via Gemini Vision multimodal reasoning (no synthetic softmax confidence score is fabricated).',
  };
}
