const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { Pinecone } = require('@pinecone-database/pinecone');
const { createEmbeddingForDimension } = require('../services/embedding.service');

// Config
const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../../knowledge_base');
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

async function ingest() {
    const pineconeKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME;
    const indexHost = process.env.PINECONE_INDEX_HOST;

    if (!pineconeKey || (!indexName && !indexHost) || pineconeKey.includes('your_')) {
        console.error('❌ Error: Missing Pinecone config. Set PINECONE_API_KEY and PINECONE_INDEX_NAME or PINECONE_INDEX_HOST.');
        process.exit(1);
    }

    // Init Pinecone
    const pc = new Pinecone({ apiKey: pineconeKey });
    const index = indexHost ? pc.index({ host: indexHost }) : pc.index({ name: indexName });
    const configuredDimension = Number(process.env.PINECONE_DIMENSION);
    let indexDimension = configuredDimension;

    if (!Number.isInteger(indexDimension) || indexDimension <= 0) {
        if (!indexName) {
            throw new Error('Set PINECONE_DIMENSION when using PINECONE_INDEX_HOST without PINECONE_INDEX_NAME.');
        }
        const indexInfo = await pc.describeIndex(indexName);
        indexDimension = indexInfo.dimension;
    }

    if (!Number.isInteger(indexDimension) || indexDimension <= 0) {
        throw new Error(`Unable to resolve a valid dimension for Pinecone index "${indexName}"`);
    }

    console.log(`ℹ️ Pinecone index "${indexName || indexHost}" dimension: ${indexDimension}`);

    // Dynamic import for ESM package
    const pdfModule = await import('pdf-parse');

    const files = fs.readdirSync(KNOWLEDGE_BASE_DIR).filter(file => file.endsWith('.pdf'));
    console.log(`📂 Found ${files.length} PDF(s) to process.`);

    for (const file of files) {
        const filePath = path.join(KNOWLEDGE_BASE_DIR, file);
        console.log(`📄 Processing ${file}...`);

        const dataBuffer = fs.readFileSync(filePath);

        // pdf-parse v2 API: Data must be passed to constructor
        const pdfParser = new pdfModule.PDFParse({ data: dataBuffer });
        const result = await pdfParser.getText();
        const text = result.text;

        // Simple chunking
        const chunks = [];
        for (let i = 0; i < text.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            chunks.push(text.slice(i, i + CHUNK_SIZE));
        }

        console.log(`   - Generated ${chunks.length} chunks.`);

        const vectors = [];
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const embeddingResult = await createEmbeddingForDimension({
                text: chunk,
                dimension: indexDimension,
                geminiApiKey: process.env.GEMINI_API_KEY,
                preferSemantic: true,
            });
            const embedding = embeddingResult.values;
            if (embeddingResult.warning && i === 0) {
                console.warn(`   ⚠️ Semantic embedding fallback for ${file}: ${embeddingResult.warning}`);
            }

            vectors.push({
                id: `${file}-${i}`,
                values: embedding,
                metadata: {
                    source: file,
                    text: chunk,
                    embedding_provider: embeddingResult.provider,
                }
            });

            // Progress
            if ((i + 1) % 5 === 0) console.log(`   - Embedded ${i + 1}/${chunks.length} chunks...`);
        }

        if (vectors.length === 0) {
            console.warn(`⚠️ No vectors generated for ${file}; skipping upsert.`);
            continue;
        }

        // Upsert to Pinecone in batches
        console.log(`🚀 Upserting ${vectors.length} vectors to Pinecone...`);
        const BATCH_SIZE = 100;
        for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
            const batch = vectors.slice(i, i + BATCH_SIZE);
            try {
                await index.upsert({ records: batch });
                console.log(`   ✓ Upserted batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(vectors.length / BATCH_SIZE)}`);
            } catch (err) {
                console.error(`   ✗ Batch upsert failed:`, err.message);
                throw err;
            }
        }
        console.log(`✅ Finished ${file}`);
    }

    console.log('✨ All files ingested successfully!');
}

ingest().catch(err => {
    console.error('❌ Ingestion failed:', err);
});
