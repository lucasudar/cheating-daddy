const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
    packagerConfig: {
        asar: {
            unpack: '**/{onnxruntime-node,onnxruntime-common,@huggingface/transformers,sharp,@img}/**',
        },
        extraResource: ['./src/assets/SystemAudioDump'],
        name: 'Cheating Daddy',
        icon: 'src/assets/logo',
        // use `security find-identity -v -p codesigning` to find your identity
        // for macos signing
        // also fuck apple
        // --- ad-hoc signing (no Apple Developer account needed) ---
        // Signs the app with an ad-hoc identity ('-') so it has a real,
        // self-consistent code signature. Combined with the postPackage hook
        // below (which signs the bundled SystemAudioDump helper with the same
        // ad-hoc identity + entitlements), this keeps the Screen Recording
        // permission stable across rebuilds and stops macOS from creating
        // duplicate TCC entries for the helper binary.
        osxSign: {
            identity: '-',
            optionsForFile: () => ({
                entitlements: 'entitlements.plist',
            }),
        },
        // notarize if off cuz i ran this for 6 hours and it still didnt finish
        // osxNotarize: {
        //    appleId: 'your apple id',
        //    appleIdPassword: 'app specific password',
        //    teamId: 'your team id',
        // },
    },
    rebuildConfig: {},
    makers: [
        {
            name: '@electron-forge/maker-squirrel',
            config: {
                name: 'cheating-daddy',
                productName: 'Cheating Daddy',
                shortcutName: 'Cheating Daddy',
                createDesktopShortcut: true,
                createStartMenuShortcut: true,
            },
        },
        {
            name: '@electron-forge/maker-dmg',
            platforms: ['darwin'],
        },
        {
            name: '@reforged/maker-appimage',
            platforms: ['linux'],
            config: {
                options: {
                    name: 'Cheating Daddy',
                    productName: 'Cheating Daddy',
                    genericName: 'AI Assistant',
                    description: 'AI assistant for interviews and learning',
                    categories: ['Development', 'Education'],
                    icon: 'src/assets/logo.png'
                }
            },
        },
    ],
    plugins: [
        {
            name: '@electron-forge/plugin-auto-unpack-natives',
            config: {},
        },
        // Fuses are used to enable/disable various Electron functionality
        // at package time, before code signing the application
        new FusesPlugin({
            version: FuseVersion.V1,
            [FuseV1Options.RunAsNode]: false,
            [FuseV1Options.EnableCookieEncryption]: true,
            [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
            [FuseV1Options.EnableNodeCliInspectArguments]: false,
            [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: false,
            [FuseV1Options.OnlyLoadAppFromAsar]: true,
        }),
    ],
    hooks: {
        // macOS only: ensure the bundled SystemAudioDump helper is ad-hoc signed
        // with the same entitlements, then RE-SIGN the whole .app so the outer
        // bundle seal stays valid (signing a nested binary after osxSign would
        // otherwise invalidate the app signature and cause a launch crash).
        // SystemAudioDump uses ScreenCaptureKit and needs Screen Recording
        // permission; signing it consistently stops macOS from registering it
        // as a separate, duplicate TCC entry.
        postPackage: async (_forgeConfig, options) => {
            if (options.platform !== 'darwin') return;
            const path = require('node:path');
            const { execFileSync } = require('node:child_process');
            const entitlements = path.resolve(__dirname, 'entitlements.plist');
            for (const outputPath of options.outputPaths) {
                const appPath = path.join(outputPath, 'Cheating Daddy.app');
                const helper = path.join(appPath, 'Contents', 'Resources', 'SystemAudioDump');
                try {
                    // 1. Sign the nested helper first (inside-out signing order)
                    execFileSync(
                        'codesign',
                        ['--force', '--sign', '-', '--entitlements', entitlements, helper],
                        { stdio: 'inherit' }
                    );
                    // 2. Re-seal the whole app bundle so its signature stays valid
                    execFileSync(
                        'codesign',
                        ['--force', '--deep', '--sign', '-', '--entitlements', entitlements, appPath],
                        { stdio: 'inherit' }
                    );
                    console.log('[postPackage] ad-hoc signed SystemAudioDump + re-sealed app:', appPath);
                } catch (err) {
                    console.warn('[postPackage] codesign step failed:', err.message);
                }
            }
        },
    },
};
