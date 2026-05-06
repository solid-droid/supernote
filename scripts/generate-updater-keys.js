import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const secretsDir = path.join(rootDir, 'scripts', 'secrets');
const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');

/**
 * Automates the generation of Tauri signing keys (minisign)
 * and updates the project configuration.
 */
function generateUpdaterKeys() {
    const password = process.argv[2];
    
    console.log('🚀 Generating Tauri signing keys...');
    
    // Ensure secrets directory exists
    if (!fs.existsSync(secretsDir)) {
        fs.mkdirSync(secretsDir, { recursive: true });
    }

    // Run tauri signer generate
    // We don't use -w here to prevent the overwrite bug and handle the update manually
    const child = spawnSync('npx', ['tauri', 'signer', 'generate'], {
        shell: true,
        input: `${password}\n${password}\n`,
        encoding: 'utf-8'
    });

    if (child.status !== 0) {
        console.error('❌ Key generation failed:', child.stderr);
        process.exit(1);
    }

    const output = child.stdout;
    
    // Regex to capture the multi-line keys from stdout
    const pubKeyMatch = output.match(/Public:\s*([\s\S]*?)(?=Environment variables|$)/i);
    const privKeyMatch = output.match(/Private: \(Keep it secret!\)\s*([\s\S]*?)(?=Public:|$)/i);

    if (pubKeyMatch && privKeyMatch) {
        const pubKey = pubKeyMatch[1].trim();
        const privKey = privKeyMatch[1].trim();

        // 1. Save Secrets
        fs.writeFileSync(path.join(secretsDir, 'TAURI_UPDATER_PRIVATE_KEY.txt'), privKey);
        fs.writeFileSync(path.join(secretsDir, 'TAURI_UPDATER_PRIVATE_KEY_PASSWORD.txt'), password);
        fs.writeFileSync(path.join(secretsDir, 'TAURI_UPDATER_PUBLIC_KEY.txt'), pubKey);
        
        console.log(`✅ Private key saved to scripts/secrets/TAURI_UPDATER_PRIVATE_KEY.txt`);
        console.log(`✅ Public key saved to scripts/secrets/TAURI_UPDATER_PUBLIC_KEY.txt`);

        // 2. Update tauri.conf.json
        try {
            const config = JSON.parse(fs.readFileSync(tauriConfPath, 'utf-8'));
            
            if (!config.plugins) config.plugins = {};
            if (!config.plugins.updater) config.plugins.updater = {};
            
            config.plugins.updater.pubkey = pubKey;
            
            fs.writeFileSync(tauriConfPath, JSON.stringify(config, null, 2));
            console.log('✅ Updated src-tauri/tauri.conf.json with new public key.');
            
            // Log the public key for reference (first line only)
            console.log(`🔑 Public Key: ${pubKey.split('\n')[1] || pubKey}`);
        } catch (err) {
            console.error('❌ Failed to update tauri.conf.json:', err.message);
        }
    } else {
        console.error('❌ Could not parse keys from command output.');
        console.log('Raw output for debugging:', output);
    }
}

generateUpdaterKeys();
