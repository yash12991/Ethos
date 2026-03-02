const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');
const { createEmbeddingForDimension } = require('../services/embedding.service');

// Helper to get Gemini model with role-based system instruction
const getGeminiModel = (apiKey, modelName = "gemini-2.5-flash", systemInstruction = "") => {
    const genAI = new GoogleGenerativeAI(apiKey);
    return genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: {
            temperature: 0.1,
            topP: 0.9,
            topK: 32,
            maxOutputTokens: 900,
        },
    });
};

let cachedDimension = null;
let cachedDimensionIndexName = null;

const getIndexDimension = async (pc, indexName) => {
    if (cachedDimension && cachedDimensionIndexName === indexName) {
        return cachedDimension;
    }

    const configuredDimension = Number(process.env.PINECONE_DIMENSION);
    let dimension = configuredDimension;

    if (!Number.isInteger(dimension) || dimension <= 0) {
        if (!indexName) {
            throw new Error('Set PINECONE_DIMENSION when using PINECONE_INDEX_HOST without PINECONE_INDEX_NAME.');
        }
        const indexInfo = await pc.describeIndex(indexName);
        dimension = indexInfo.dimension;
    }

    if (!Number.isInteger(dimension) || dimension <= 0) {
        throw new Error(`Unable to resolve a valid dimension for Pinecone index "${indexName}"`);
    }

    cachedDimension = dimension;
    cachedDimensionIndexName = indexName;
    return dimension;
};

const sanitizeReply = (text) => {
    if (typeof text !== 'string') return '';

    return text
        .replace(/\*\*/g, '')
        .replace(/__/g, '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/^[*-]\s+/gm, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
};

const MAX_HISTORY_TURNS = 12;
const MAX_HISTORY_TEXT_CHARS = 1800;

const normalizeRoleForGemini = (role) => {
    if (role === 'assistant' || role === 'model' || role === 'bot') return 'model';
    return 'user';
};

const sanitizeTurnText = (value) => {
    if (typeof value !== 'string') return '';
    return value
        .replace(/\r/g, '')
        .replace(/\u0000/g, '')
        .trim()
        .slice(0, MAX_HISTORY_TEXT_CHARS);
};

const normalizeHistoryToGeminiContents = (history) => {
    if (!Array.isArray(history)) return [];

    return history
        .slice(-MAX_HISTORY_TURNS)
        .map((item) => {
            const text = sanitizeTurnText(item?.content);
            if (!text) return null;

            return {
                role: normalizeRoleForGemini(item?.role),
                parts: [{ text }],
            };
        })
        .filter(Boolean);
};

const MENTAL_HEALTH_CONTACTS = [
    {
        name: '988 Suicide and Crisis Lifeline',
        contact: 'Call or text 988',
        scope: '24/7 crisis support in the United States',
    },
    {
        name: 'Crisis Text Line',
        contact: 'Text HOME to 741741',
        scope: '24/7 confidential text-based emotional support',
    },
    {
        name: "SAMHSA National Helpline",
        contact: 'Call 1-800-662-4357',
        scope: '24/7 treatment referral and mental health/substance use support',
    },
];

const DISTRESS_PATTERN = /\b(suicid|self[-\s]?harm|panic|severe anxiety|depress|hopeless|unsafe|threat|abuse|harass|trauma|mental health|psychologist|counselor|counselling|therapy)\b/i;

const shouldAttachMentalHealthContacts = (message) => {
    if (typeof message !== 'string') return false;
    return DISTRESS_PATTERN.test(message);
};

const buildMentalHealthContactsText = () => {
    const lines = ['Mental health support contacts:'];
    MENTAL_HEALTH_CONTACTS.forEach((item, idx) => {
        lines.push(`${idx + 1}. ${item.name}: ${item.contact} (${item.scope})`);
    });
    lines.push('4. If you need a licensed psychologist for ongoing care, ask your HR/EAP for an approved local provider list.');
    return lines.join('\n');
};

const ETHOS_WEBSITE_CONTEXT = `
ETHOS website routes and purpose:
- /dashboard/file-complaint: submit a new complaint.
- /dashboard/my-complaints: track complaint status and view details.
- /dashboard/messages: chat with HR and share case updates.
- /dashboard/support: chat with ETHOS Support AI.
- /dashboard/profile: manage account and security settings.
`;

const getRelevantWebsiteRoutes = (message) => {
    if (typeof message !== 'string') return [];
    const q = message.toLowerCase();
    const routes = [];

    if (/\b(file|submit|create|report)\b/.test(q) && /\bcomplaint|issue|harass|abuse|incident\b/.test(q)) {
        routes.push('/dashboard/file-complaint');
    }
    if (/\b(evidence|upload|document|proof|attachment)\b/.test(q)) {
        routes.push('/dashboard/file-complaint');
    }
    if (/\b(track|status|progress|follow|update|my complaint|complaint id)\b/.test(q)) {
        routes.push('/dashboard/my-complaints');
    }
    if (/\b(message|chat with hr|reply|respond|thread|conversation)\b/.test(q)) {
        routes.push('/dashboard/messages');
    }
    if (/\b(profile|account|password|security|login)\b/.test(q)) {
        routes.push('/dashboard/profile');
    }
    if (/\b(help|support|assistant|chat|guidance)\b/.test(q)) {
        routes.push('/dashboard/support');
    }

    return [...new Set(routes)].slice(0, 3);
};

const routeDescriptions = {
    '/dashboard/file-complaint': 'Submit a new complaint',
    '/dashboard/my-complaints': 'Track complaint status and details',
    '/dashboard/messages': 'Chat with HR about case updates',
    '/dashboard/profile': 'Manage account and password settings',
    '/dashboard/support': 'Talk to ETHOS Support AI',
};

const extractRetryAfterSeconds = (message = '', details = null) => {
    const text = [message, typeof details === 'string' ? details : JSON.stringify(details || {})]
        .filter(Boolean)
        .join(' ');

    const retryInMatch = text.match(/Please\s+retry\s+in\s+([\d.]+)s/i);
    if (retryInMatch?.[1]) {
        const parsed = Math.ceil(Number(retryInMatch[1]));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    const retryDelayMatch = text.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
    if (retryDelayMatch?.[1]) {
        const parsed = Number(retryDelayMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return null;
};

const isGeminiQuotaError = (err) => {
    const statusCode = Number(err?.status || err?.statusCode || err?.code);
    const message = String(err?.message || '');
    return (
        statusCode === 429 ||
        /429\s+Too\s+Many\s+Requests/i.test(message) ||
        /quota\s+exceeded/i.test(message)
    );
};

async function handleSupportChat(req, res, next) {
    try {
        const { message, history = [] } = req.body;
        const geminiKey = process.env.GEMINI_API_KEY;
        const pineconeKey = process.env.PINECONE_API_KEY;
        const indexName = process.env.PINECONE_INDEX_NAME;
        const indexHost = process.env.PINECONE_INDEX_HOST;
        const normalizedMessage = sanitizeTurnText(message);

        if (!normalizedMessage) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        if (!geminiKey || !pineconeKey || (!indexName && !indexHost)) {
            return res.status(500).json({
                success: false,
                error: 'Server is missing GEMINI_API_KEY, PINECONE_API_KEY, and either PINECONE_INDEX_NAME or PINECONE_INDEX_HOST',
            });
        }

        const geminiHistory = normalizeHistoryToGeminiContents(history);

        // 1. Resolve index and dimension, then create query embedding
        const pc = new Pinecone({ apiKey: pineconeKey });
        const dimension = await getIndexDimension(pc, indexName);
        const semanticQueryEmbedding = await createEmbeddingForDimension({
            text: normalizedMessage,
            dimension,
            geminiApiKey: geminiKey,
            preferSemantic: true,
        });
        if (semanticQueryEmbedding.warning) {
            console.warn('Support chat embedding fallback:', semanticQueryEmbedding.warning);
        }

        // 2. Query Pinecone
        const index = indexHost ? pc.index({ host: indexHost }) : pc.index({ name: indexName });
        let queryResponse = await index.query({
            vector: semanticQueryEmbedding.values,
            topK: 5,
            includeMetadata: true,
        });

        let queryProviderUsed = semanticQueryEmbedding.provider;
        const semanticTopScore = queryResponse?.matches?.[0]?.score || 0;

        // Compatibility safeguard:
        // If semantic query looks weak and index may still hold old hash vectors, retry with hash query.
        if (semanticTopScore < 0.35 && semanticQueryEmbedding.provider !== 'hash_fallback') {
            const hashQueryEmbedding = await createEmbeddingForDimension({
                text: normalizedMessage,
                dimension,
                geminiApiKey: geminiKey,
                preferSemantic: false,
            });
            const hashQueryResponse = await index.query({
                vector: hashQueryEmbedding.values,
                topK: 5,
                includeMetadata: true,
            });

            const hashTopScore = hashQueryResponse?.matches?.[0]?.score || 0;
            if (hashTopScore > semanticTopScore) {
                queryResponse = hashQueryResponse;
                queryProviderUsed = hashQueryEmbedding.provider;
            }
        }

        const matches = queryResponse.matches || [];
        const bestMatch = matches[0];
        const threshold = 0.35; // Similarity threshold for treating retrieval as trustworthy

        const retrievedContext = matches
            .map((m, idx) => {
                const source = m?.metadata?.source || `source_${idx + 1}`;
                const text = m?.metadata?.text || '';
                const score = typeof m?.score === 'number' ? m.score.toFixed(4) : 'n/a';
                return `[${source}] (score: ${score})\n${text}`;
            })
            .filter(Boolean)
            .join("\n\n---\n\n");

        const hasRetrievedContext = Boolean(retrievedContext);
        const useRAG = Boolean(bestMatch && bestMatch.score >= threshold && hasRetrievedContext);

        // 3. Synthesize response with role-based chat turns
        let systemInstruction = "";
        const needsMentalHealthContacts = shouldAttachMentalHealthContacts(normalizedMessage);

        if (useRAG) {
            systemInstruction = `
You are the ETHOS Support Assistant.
Answer with high factual accuracy and safety.
Stay tightly aligned to ETHOS website workflows and page routes.

Decision flow:
1) Determine if the user question is related to workplace safety, ethics, harassment, complaint reporting, employee rights at work, HR process, or internal support.
2) Because retrieved context is available, ground the answer in that context first.
3) If context only partially answers the question, explicitly state what is missing and then add clearly labeled general guidance.
4) If the question is related but not fully answered by context, DO NOT refuse. Provide best-effort practical guidance.
5) Only decline when the topic is clearly unrelated to workplace/HR/ethics/safety support.

Output rules:
1) Do not provide legal verdicts, diagnosis, or guaranteed outcomes.
2) Keep the answer practical and concise (target up to 320 words when needed).
3) Output plain text only. No markdown symbols such as **, __, #, -, or * bullets.
4) If there are action steps, format exactly as "1. ... 2. ..." plain text.
5) If the user appears distressed, unsafe, harassed, or asks for psychologist/help numbers, include a short safety line: "If this feels urgent or unsafe, contact HR or emergency services immediately."
6) If the user appears distressed, unsafe, harassed, or asks for psychologist/help numbers, include a short "Mental health support contacts" section with named services and phone/text details.
7) If relevant, mention ETHOS internal routes in plain text: /dashboard/file-complaint, /dashboard/my-complaints, /dashboard/messages, /dashboard/profile.

Website Context:
${ETHOS_WEBSITE_CONTEXT}

Conversation History:
Conversation continuity should use prior turns if provided.`;
        } else {
            systemInstruction = `
You are the ETHOS Support Assistant.
Retrieved vector snippets are available but not strongly reliable, or policy context is missing.
Stay tightly aligned to ETHOS website workflows and page routes.

Decision flow:
1) Determine if the user question is related to workplace safety, ethics, harassment, complaint reporting, employee rights at work, HR process, or internal support.
2) Use the retrieved snippets as supplemental hints only; do not treat weak snippets as authoritative facts.
3) If related, provide best-effort practical guidance from general HR/workplace safety knowledge.
4) If related, do NOT refuse only because context is missing.
5) If unrelated, politely decline.
6) Clearly mention this is general guidance when policy context is unavailable.

Output rules:
1) Do not provide legal verdicts, diagnosis, or guaranteed outcomes.
2) Keep the answer concise and actionable (target up to 300 words when needed).
3) Output plain text only. No markdown symbols such as **, __, #, -, or * bullets.
4) If there are action steps, format exactly as "1. ... 2. ..." plain text.
5) If the user appears distressed, unsafe, harassed, or asks for psychologist/help numbers, include a short safety line: "If this feels urgent or unsafe, contact HR or emergency services immediately."
6) If the user appears distressed, unsafe, harassed, or asks for psychologist/help numbers, include a short "Mental health support contacts" section with named services and phone/text details.
7) If relevant, mention ETHOS internal routes in plain text: /dashboard/file-complaint, /dashboard/my-complaints, /dashboard/messages, /dashboard/profile.

Website Context:
${ETHOS_WEBSITE_CONTEXT}

Conversation History:
Conversation continuity should use prior turns if provided.`;
        }

        const model = getGeminiModel(geminiKey, "gemini-2.5-flash", systemInstruction);

        const contents = [...geminiHistory];

        contents.push({
            role: 'user',
            parts: [{
                text: `Retrieved Context:
${retrievedContext || "No retrieved context available."}

Context Confidence: ${useRAG ? "high" : "low_or_partial"}

User Question:
${normalizedMessage}`,
            }],
        });

        const result = await model.generateContent({ contents });
        let responseText = sanitizeReply(result.response.text());
        const suggestedRoutes = getRelevantWebsiteRoutes(normalizedMessage);

        if (!needsMentalHealthContacts) {
            responseText = responseText
                .replace(/\s*If this feels urgent or unsafe, contact HR or emergency services immediately\.?\s*/gi, ' ')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }

        if (suggestedRoutes.length > 0) {
            const routeBlock = `Relevant ETHOS pages:\n${suggestedRoutes
                .map((route, i) => `${i + 1}. ${route} - ${routeDescriptions[route] || 'Open this page for the next step'}`)
                .join('\n')}`;
            if (!responseText.includes('Relevant ETHOS pages:')) {
                responseText = `${responseText}\n\n${routeBlock}`;
            }
        }

        if (needsMentalHealthContacts) {
            responseText = `${responseText}\n\n${buildMentalHealthContactsText()}`;
        }

        return res.json({
            success: true,
            data: {
                reply: responseText,
                source: useRAG ? 'knowledge_base' : 'general_knowledge',
                citations: matches.map(m => m?.metadata?.source).filter(Boolean),
                embeddingProvider: queryProviderUsed,
            }
        });

    } catch (err) {
        if (isGeminiQuotaError(err)) {
            const retryAfterSeconds = extractRetryAfterSeconds(err?.message, err?.details) || 60;
            return res.status(429).json({
                success: false,
                message: `AI usage limit reached. Please retry in about ${retryAfterSeconds} seconds.`,
                details: {
                    code: 'GEMINI_QUOTA_EXCEEDED',
                    retryAfterSeconds,
                },
            });
        }

        return next(err);
    }
}

module.exports = {
    handleSupportChat,
};
