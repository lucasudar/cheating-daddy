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
        // osxSign with identity '-' deep-signs the whole bundle (Electron
        // Framework, helpers, and the bundled SystemAudioDump) in the correct
        // inside-out order, giving a self-consistent ad-hoc signature. This
        // keeps the Screen Recording permission stable across rebuilds.
        // NOTE: do NOT re-sign nested binaries afterward with `codesign --deep`
        // — that invalidates the framework signature and macOS kills the app
        // with SIGKILL (Code Signature Invalid). Let osxSign do the whole job.
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
        // macOS only: ad-hoc sign the bundled SystemAudioDump helper BEFORE
        // osxSign seals the whole bundle. osxSign runs at the very end of
        // packaging, so signing the helper here (during copy) means the final
        // osxSign pass wraps an already-signed helper in the correct order.
        // We must NOT sign anything AFTER osxSign (that invalidates the
        // Electron Framework signature -> SIGKILL Code Signature Invalid).
        // SystemAudioDump uses ScreenCaptureKit and needs Screen Recording
        // permission; signing it consistently helps macOS keep one TCC entry.
        packageAfterCopy: async (_forgeConfig, buildPath, _electronVersion, platform) => {
            if (platform !== 'darwin') return;
            const path = require('node:path');
            const fs = require('node:fs');
            const { execFileSync } = require('node:child_process');
            const entitlements = path.resolve(__dirname, 'entitlements.plist');
            // extraResource lands at <buildPath>/../Resources or inside Resources;
            // search for the helper under the build path.
            const candidates = [
                path.join(buildPath, 'SystemAudioDump'),
                path.join(buildPath, '..', 'Resources', 'SystemAudioDump'),
            ];
            const helper = candidates.find(p => fs.existsSync(p));
            if (!helper) {
                console.warn('[packageAfterCopy] SystemAudioDump not found yet; osxSign will sign it in the final pass');
                return;
            }
            try {
                execFileSync(
                    'codesign',
                    ['--force', '--sign', '-', '--entitlements', entitlements, helper],
                    { stdio: 'inherit' }
                );
                console.log('[packageAfterCopy] ad-hoc signed SystemAudioDump:', helper);
            } catch (err) {
                console.warn('[packageAfterCopy] failed to sign SystemAudioDump:', err.message);
            }
        },
    },
};
