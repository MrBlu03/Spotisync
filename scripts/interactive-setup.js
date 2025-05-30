#!/usr/bin/env node

/**
 * Interactive Setup Script for Spotisync
 * This script automates the entire setup process including:
 * - Installing dependencies
 * - YouTube Music authentication headers
 * - Running the Python setup script
 * - Starting the application
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, exec } = require('child_process');

class SpotisyncSetup {    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.projectRoot = path.resolve(__dirname, '..');
        this.rawHeadersPath = path.join(this.projectRoot, 'raw_headers.txt');
        this.oauthPath = path.join(this.projectRoot, 'oauth.json');
    }

    async question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    async execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, { cwd: this.projectRoot, ...options }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async spawnCommand(command, args, options = {}) {
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { 
                cwd: this.projectRoot, 
                stdio: 'inherit',
                shell: true,
                ...options 
            });
            
            child.on('close', (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(new Error(`Command exited with code ${code}`));
                }
            });
        });
    }    displayHeader() {
        console.log('\n' + '='.repeat(60));
        console.log('🎵 SPOTISYNC INTERACTIVE SETUP 🎵');
        console.log('='.repeat(60));
        console.log('This script will guide you through the complete setup process.');
        console.log('Make sure you have Node.js and Python installed.');
        console.log('Spotify authentication will be handled through the web interface.\n');
    }    async checkPrerequisites() {
        console.log('📋 Checking prerequisites...\n');

        // Check Node.js
        try {
            const { stdout: nodeVersion } = await this.execCommand('node --version');
            console.log(`✅ Node.js: ${nodeVersion.trim()}`);
        } catch (error) {
            console.log('❌ Node.js not found. Please install Node.js first.');
            process.exit(1);
        }

        // Check Python with fallback commands
        let pythonFound = false;
        let pythonVersion = '';
        
        const pythonCommands = ['python --version', 'python3 --version', 'py --version'];
        
        for (const cmd of pythonCommands) {
            try {
                const result = await this.execCommand(cmd);
                pythonVersion = result.stdout.trim() || result.stderr.trim();
                pythonFound = true;
                break;
            } catch {
                // Try next command
            }
        }
        
        if (pythonFound) {
            console.log(`✅ Python: ${pythonVersion}`);
        } else {
            console.log('❌ Python not found. Please install Python first.');
            process.exit(1);
        }

        console.log('');
    }async installDependencies() {
        console.log('📦 Installing dependencies...\n');

        console.log('Installing Node.js dependencies...');
        try {
            await this.spawnCommand('npm', ['install']);
            console.log('✅ Node.js dependencies installed successfully');
        } catch (error) {
            console.log('❌ Failed to install Node.js dependencies');
            throw error;
        }

        console.log('\nInstalling Python dependencies...');
        try {
            // Try different Python commands
            let pythonCmd = 'python';
            try {
                await this.execCommand('python --version');
            } catch {
                try {
                    await this.execCommand('python3 --version');
                    pythonCmd = 'python3';
                } catch {
                    try {
                        await this.execCommand('py --version');
                        pythonCmd = 'py';
                    } catch {
                        throw new Error('Python not found. Please ensure Python is installed and in PATH.');
                    }
                }
            }
            
            await this.spawnCommand(pythonCmd, ['-m', 'pip', 'install', '-r', 'requirements.txt']);
            console.log('✅ Python dependencies installed successfully');
        } catch (error) {
            console.log('❌ Failed to install Python dependencies');
            console.log('You may need to install them manually with: pip install -r requirements.txt');
            // Don't throw error, continue with setup
        }

        console.log('');
    }async setupYouTubeMusic() {
        console.log('🎬 Setting up YouTube Music authentication...\n');

        console.log('Follow these steps to get your YouTube Music headers:');
        console.log('1. Open YouTube Music in your browser and log in');
        console.log('2. Open Developer Tools (F12)');
        console.log('3. Go to Network tab');
        console.log('4. Search for a song or interact with YouTube Music');
        console.log('5. Find a request to "youtubei/v1/..." in the Network tab');
        console.log('6. Right-click the request → Copy → Copy as cURL');
        console.log('7. Extract the headers from the cURL command');
        console.log('8. Paste the raw headers below\n');

        console.log('Paste your raw headers (press Enter twice when done):');
        
        let headers = '';
        let emptyLineCount = 0;
        
        return new Promise((resolve) => {
            const headerInterface = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
                prompt: ''
            });

            headerInterface.on('line', (line) => {
                if (line.trim() === '') {
                    emptyLineCount++;
                    if (emptyLineCount >= 2) {
                        headerInterface.close();
                        // Write headers to file (completely overwrite)
                        fs.writeFileSync(this.rawHeadersPath, headers.trim());
                        console.log('\n✅ Headers saved to raw_headers.txt');
                        resolve();
                        return;
                    }
                } else {
                    emptyLineCount = 0;
                    headers += line + '\n';
                }
            });
        });
    }    async runYouTubeMusicSetup() {
        console.log('\n🔧 Running YouTube Music setup script...\n');

        try {
            // Try different Python commands
            let pythonCmd = 'python';
            try {
                await this.execCommand('python --version');
            } catch {
                try {
                    await this.execCommand('python3 --version');
                    pythonCmd = 'python3';
                } catch {
                    try {
                        await this.execCommand('py --version');
                        pythonCmd = 'py';
                    } catch {
                        throw new Error('Python not found. Please ensure Python is installed and in PATH.');
                    }
                }
            }

            await this.spawnCommand(pythonCmd, ['scripts/setup-ytmusic.py']);
            console.log('✅ YouTube Music authentication setup completed');
            
            // Verify oauth.json was created
            if (fs.existsSync(this.oauthPath)) {
                console.log('✅ oauth.json file created successfully');
            } else {
                throw new Error('oauth.json file was not created');
            }
        } catch (error) {
            console.log('❌ Failed to setup YouTube Music authentication');
            throw error;
        }

        console.log('');
    }async verifySetup() {
        console.log('✅ Verifying setup...\n');

        const checks = [
            { file: this.rawHeadersPath, name: 'raw_headers.txt' },
            { file: this.oauthPath, name: 'oauth.json' },
            { file: path.join(this.projectRoot, 'node_modules'), name: 'Node.js dependencies' }
        ];

        let allGood = true;
        for (const check of checks) {
            if (fs.existsSync(check.file)) {
                console.log(`✅ ${check.name}`);
            } else {
                console.log(`❌ ${check.name} missing`);
                allGood = false;
            }
        }

        if (!allGood) {
            throw new Error('Setup verification failed');
        }

        console.log('\n🎉 Setup verification completed successfully!');
        console.log('Note: Spotify authentication will be handled through the web interface.\n');
    }    async startApplication() {
        console.log('🚀 Starting Spotisync...\n');

        // Check if we're being called from the batch file
        const fromBatch = process.env.SPOTISYNC_FROM_BATCH === 'true';
        
        if (fromBatch) {
            console.log('✅ Setup completed! The batch file will handle starting the application.');
            this.rl.close();
            return;
        }

        const startNow = await this.question('Would you like to start the application now? (y/n): ');
        
        if (startNow.toLowerCase() === 'y' || startNow.toLowerCase() === 'yes') {
            console.log('\nStarting Spotisync server...');
            console.log('The application will be available at: http://localhost:3000');
            console.log('You can authenticate with Spotify through the web interface.');
            console.log('Press Ctrl+C to stop the server when you\'re done.\n');
            
            this.rl.close();
            
            // Start the server in a detached process so it continues running
            const { spawn } = require('child_process');
            const child = spawn('npm', ['run', 'start:all'], {
                cwd: this.projectRoot,
                stdio: 'inherit',
                shell: true,
                detached: false
            });
            
            // Handle process termination
            process.on('SIGINT', () => {
                console.log('\n\nShutting down Spotisync server...');
                child.kill('SIGTERM');
                process.exit(0);
            });
            
            child.on('error', (error) => {
                console.log('❌ Failed to start application:', error.message);
                console.log('You can start it manually with: npm run start:all');
                process.exit(1);
            });
            
            child.on('exit', (code) => {
                if (code !== 0) {
                    console.log(`\n❌ Application exited with code ${code}`);
                    console.log('You can start it manually with: npm run start:all');
                }
                process.exit(code);
            });
            
        } else {
            console.log('\n✅ Setup completed! Run "npm run start:all" when you\'re ready to start.');
            this.rl.close();
        }
    }

    async waitForExit() {
        console.log('\nSetup completed. Press Enter to exit...');
        return new Promise((resolve) => {
            const exitInterface = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            exitInterface.question('', () => {
                exitInterface.close();
                resolve();
            });
        });
    }    async run() {
        try {
            this.displayHeader();
            await this.checkPrerequisites();
            await this.installDependencies();
            await this.setupYouTubeMusic();
            await this.runYouTubeMusicSetup();
            await this.verifySetup();
            await this.startApplication();
        } catch (error) {
            console.log('\n❌ Setup failed:', error.message);
            console.log('\nPlease check the error above and try again.');
            await this.waitForExit();
        }
    }
}

// Run the setup if this script is executed directly
if (require.main === module) {
    const setup = new SpotisyncSetup();
    setup.run();
}

module.exports = SpotisyncSetup;
