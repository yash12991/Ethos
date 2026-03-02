const crypto = require('crypto');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const DEFAULT_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
const EMBEDDING_MODEL_FALLBACKS = ['text-embedding-004', 'gemini-embedding-001'];
const EPSILON = 1e-8;

let cachedEmbeddingModel = null;
let cachedEmbeddingKey = null;
let cachedEmbeddingModelName = null;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const normalizeVector = (vector) => {
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (norm < EPSILON) return vector;
  return vector.map((v) => v / norm);
};

const hashEmbedding = (text, dimension) => {
  const safeText = text && text.length > 0 ? text : ' ';
  const hash = crypto.createHash('md5').update(safeText).digest('hex');

  const values = Array(dimension).fill(0).map((_, idx) => {
    const hashChar = hash.charCodeAt(idx % hash.length);
    const textChar = safeText.charCodeAt(idx % safeText.length);
    const combined = (hashChar + textChar) / 512;
    return combined > 1 ? 0.99 : combined < -1 ? -0.99 : combined;
  });

  return normalizeVector(values);
};

const resizeVector = (vector, targetDimension) => {
  if (!Array.isArray(vector) || vector.length === 0) {
    return Array(targetDimension).fill(0);
  }
  if (vector.length === targetDimension) return vector;

  const resized = new Array(targetDimension).fill(0);
  const sourceMax = vector.length - 1;
  const targetMax = targetDimension - 1;

  for (let i = 0; i < targetDimension; i += 1) {
    const mapped = targetMax === 0 ? 0 : (i * sourceMax) / targetMax;
    const left = Math.floor(mapped);
    const right = Math.ceil(mapped);
    const weight = mapped - left;
    const leftVal = vector[left] ?? 0;
    const rightVal = vector[right] ?? leftVal;
    resized[i] = leftVal * (1 - weight) + rightVal * weight;
  }

  return resized;
};

const getGeminiEmbeddingModel = (apiKey, modelName = DEFAULT_EMBEDDING_MODEL) => {
  if (cachedEmbeddingModel && cachedEmbeddingKey === apiKey && cachedEmbeddingModelName === modelName) {
    return cachedEmbeddingModel;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  cachedEmbeddingModel = genAI.getGenerativeModel({ model: modelName });
  cachedEmbeddingKey = apiKey;
  cachedEmbeddingModelName = modelName;
  return cachedEmbeddingModel;
};

const createSemanticEmbedding = async (text, apiKey, modelName = DEFAULT_EMBEDDING_MODEL) => {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required for semantic embeddings');
  }

  const candidateModels = [...new Set([modelName, ...EMBEDDING_MODEL_FALLBACKS])];
  let lastError = null;
  const attempted = [];

  for (const candidate of candidateModels) {
    try {
      attempted.push(candidate);
      const model = getGeminiEmbeddingModel(apiKey, candidate);
      const result = await model.embedContent(text);
      const values = result?.embedding?.values;

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error(`Gemini embedding response was empty for model ${candidate}`);
      }

      return {
        values: normalizeVector(values.map((value) => clamp(Number(value) || 0, -1, 1))),
        modelUsed: candidate,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const errorMessage = lastError instanceof Error ? lastError.message : 'Unknown embedding error';
  throw new Error(`Unable to generate semantic embeddings (attempted: ${attempted.join(', ')}). Last error: ${errorMessage}`);
};

const createEmbeddingForDimension = async ({
  text,
  dimension,
  geminiApiKey,
  embeddingModel = DEFAULT_EMBEDDING_MODEL,
  preferSemantic = true,
}) => {
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error('createEmbeddingForDimension requires a positive integer dimension');
  }

  const safeText = text && text.length > 0 ? text : ' ';

  if (!preferSemantic) {
    return {
      values: hashEmbedding(safeText, dimension),
      provider: 'hash',
      semanticDimension: null,
    };
  }

  try {
    const semanticResult = await createSemanticEmbedding(safeText, geminiApiKey, embeddingModel);
    const semantic = semanticResult.values;
    const fitted = semantic.length === dimension ? semantic : resizeVector(semantic, dimension);
    return {
      values: normalizeVector(fitted),
      provider:
        semantic.length === dimension
          ? `gemini:${semanticResult.modelUsed}`
          : `gemini_resized:${semanticResult.modelUsed}`,
      semanticDimension: semantic.length,
    };
  } catch (error) {
    return {
      values: hashEmbedding(safeText, dimension),
      provider: 'hash_fallback',
      semanticDimension: null,
      warning: error instanceof Error ? error.message : 'Semantic embedding failed',
    };
  }
};

module.exports = {
  createEmbeddingForDimension,
  createSemanticEmbedding,
  hashEmbedding,
  resizeVector,
};
