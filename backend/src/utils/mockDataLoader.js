const https = require('https');

const staticPhrases = [
    "silver moon cedar harbor 47", "drift velvet north flame 63", "apple quiet lantern wave 82", "ocean forest mountain river 12", "desert storm crystal dream 99",
    "echo shadow light starlight 54", "emerald sapphire amber bronze 31", "iron steel gold platinum 88", "diamond pearl ruby topaz 42", "quartz midnight twilight dawn 19",
    "sunset sunrise nebula galaxy 76", "comet asteroid orbit planet 28", "cosmos vacuum silver apple 65", "drift moon quiet cedar 37", "lantern wave harbor velvet 22",
    "north flame ocean forest 81", "mountain river desert storm 53", "crystal dream echo shadow 14", "light starlight emerald sapphire 90", "amber bronze iron steel 46",
    "gold platinum diamond pearl 72", "ruby topaz quartz midnight 25", "twilight dawn sunset sunrise 64", "nebula galaxy comet asteroid 33", "orbit planet cosmos vacuum 87",
    "silver apple drift moon 11", "quiet cedar lantern wave 25", "harbor velvet north flame 95", "ocean forest mountain river 32", "desert storm crystal dream 51",
    "echo shadow light starlight 69", "emerald sapphire amber bronze 52", "iron steel gold platinum 55", "diamond pearl ruby topaz 42", "quartz midnight twilight dawn 81",
    "sunset sunrise nebula galaxy 40", "comet asteroid orbit planet 75", "cosmos vacuum silver apple 63", "drift moon quiet cedar 76", "lantern wave harbor velvet 43",
    "north flame ocean forest 48", "mountain river desert storm 43", "crystal dream echo shadow 65", "light starlight emerald sapphire 55", "amber bronze iron steel 37",
    "gold platinum diamond pearl 64", "ruby topaz quartz midnight 22", "twilight dawn sunset sunrise 77", "nebula galaxy comet asteroid 21", "orbit planet cosmos vacuum 19"
];

function buildLocalAlias() {
    const left = ['quiet', 'silver', 'ocean', 'north', 'ember', 'velvet', 'cedar', 'nova', 'lunar', 'echo'];
    const right = ['harbor', 'trail', 'field', 'river', 'ridge', 'flame', 'grove', 'cloud', 'stone', 'spark'];
    const n = Math.floor(Math.random() * 9000) + 1000;
    return `${left[Math.floor(Math.random() * left.length)]}_${right[Math.floor(Math.random() * right.length)]}_${n}`;
}

function buildLocalAliases(count = 5) {
    const aliases = [];
    const seen = new Set();
    while (aliases.length < count) {
        const alias = buildLocalAlias();
        if (seen.has(alias)) continue;
        seen.add(alias);
        aliases.push(alias);
    }
    return aliases;
}

/**
 * Fetches aliases from Random User API live
 */
async function fetchExternalAliases(count = 5) {
    return new Promise((resolve, reject) => {
        const req = https.get(`https://randomuser.me/api/?results=${count}&inc=login&nat=us`, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const results = Array.isArray(parsed?.results) ? parsed.results : [];
                    const aliases = results
                        .map((r) => r?.login?.username)
                        .filter((value) => typeof value === 'string' && value.trim().length > 0);
                    if (aliases.length === 0) {
                        resolve(buildLocalAliases(count));
                        return;
                    }
                    resolve(aliases);
                } catch (err) {
                    resolve(buildLocalAliases(count));
                }
            });
        });

        req.setTimeout(5000, () => {
            req.destroy(new Error('request timeout'));
        });

        req.on('error', () => {
            resolve(buildLocalAliases(count));
        });
    });
}

function getRandomRecoveryPhrase() {
    return staticPhrases[Math.floor(Math.random() * staticPhrases.length)];
}

module.exports = {
    fetchExternalAliases,
    getRandomRecoveryPhrase,
};
