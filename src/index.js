if (require('electron-squirrel-startup')) {
    process.exit(0);
}

const { app, BrowserWindow, shell, ipcMain } = require('electron');
const { createWindow, updateGlobalShortcuts } = require('./utils/window');
const { setupGeminiIpcHandlers, stopMacOSAudioCapture, sendToRenderer } = require('./utils/gemini');
const storage = require('./storage');

const geminiSessionRef = { current: null };
let mainWindow = null;

function createMainWindow() {
    mainWindow = createWindow(sendToRenderer, geminiSessionRef);
    return mainWindow;
}

app.whenReady().then(async () => {
    // Initialize storage (checks version, resets if needed)
    storage.initializeStorage();

    // On macOS, check Screen Recording permission. desktopCapturer throws
    // "Failed to get sources" when it is not granted, so probe the status
    // explicitly and trigger the system prompt. The first getSources() call
    // is what makes the app appear in System Settings > Screen Recording.
    if (process.platform === 'darwin') {
        const { desktopCapturer, systemPreferences } = require('electron');
        try {
            const status =
                typeof systemPreferences.getMediaAccessStatus === 'function'
                    ? systemPreferences.getMediaAccessStatus('screen')
                    : 'unknown';
            console.log(`[startup] Screen Recording permission = ${status}`);
        } catch (e) {
            console.warn('[startup] could not read screen permission:', e.message);
        }
        // Probe to register the app in the Screen Recording list / trigger prompt.
        // Swallow the rejection so it does not surface as UnhandledPromiseRejection.
        try {
            await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
        } catch (e) {
            console.warn('[startup] screen probe failed (permission likely denied):', e && e.message);
        }
    }

    createMainWindow();
    setupGeminiIpcHandlers(geminiSessionRef);
    setupStorageIpcHandlers();
    setupGeneralIpcHandlers();
});

app.on('window-all-closed', () => {
    stopMacOSAudioCapture();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopMacOSAudioCapture();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
    }
});

function setupStorageIpcHandlers() {
    // ============ CONFIG ============
    ipcMain.handle('storage:get-config', async () => {
        try {
            return { success: true, data: storage.getConfig() };
        } catch (error) {
            console.error('Error getting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-config', async (event, config) => {
        try {
            storage.setConfig(config);
            return { success: true };
        } catch (error) {
            console.error('Error setting config:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-config', async (event, key, value) => {
        try {
            storage.updateConfig(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating config:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CREDENTIALS ============
    ipcMain.handle('storage:get-credentials', async () => {
        try {
            return { success: true, data: storage.getCredentials() };
        } catch (error) {
            console.error('Error getting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-credentials', async (event, credentials) => {
        try {
            storage.setCredentials(credentials);
            return { success: true };
        } catch (error) {
            console.error('Error setting credentials:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-api-key', async () => {
        try {
            return { success: true, data: storage.getApiKey() };
        } catch (error) {
            console.error('Error getting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-api-key', async (event, apiKey) => {
        try {
            storage.setApiKey(apiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-groq-api-key', async () => {
        try {
            return { success: true, data: storage.getGroqApiKey() };
        } catch (error) {
            console.error('Error getting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-groq-api-key', async (event, groqApiKey) => {
        try {
            storage.setGroqApiKey(groqApiKey);
            return { success: true };
        } catch (error) {
            console.error('Error setting Groq API key:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ PREFERENCES ============
    ipcMain.handle('storage:get-preferences', async () => {
        try {
            return { success: true, data: storage.getPreferences() };
        } catch (error) {
            console.error('Error getting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-preferences', async (event, preferences) => {
        try {
            storage.setPreferences(preferences);
            return { success: true };
        } catch (error) {
            console.error('Error setting preferences:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:update-preference', async (event, key, value) => {
        try {
            storage.updatePreference(key, value);
            return { success: true };
        } catch (error) {
            console.error('Error updating preference:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ KEYBINDS ============
    ipcMain.handle('storage:get-keybinds', async () => {
        try {
            return { success: true, data: storage.getKeybinds() };
        } catch (error) {
            console.error('Error getting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:set-keybinds', async (event, keybinds) => {
        try {
            storage.setKeybinds(keybinds);
            return { success: true };
        } catch (error) {
            console.error('Error setting keybinds:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ HISTORY ============
    ipcMain.handle('storage:get-all-sessions', async () => {
        try {
            return { success: true, data: storage.getAllSessions() };
        } catch (error) {
            console.error('Error getting sessions:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:get-session', async (event, sessionId) => {
        try {
            return { success: true, data: storage.getSession(sessionId) };
        } catch (error) {
            console.error('Error getting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:save-session', async (event, sessionId, data) => {
        try {
            storage.saveSession(sessionId, data);
            return { success: true };
        } catch (error) {
            console.error('Error saving session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-session', async (event, sessionId) => {
        try {
            storage.deleteSession(sessionId);
            return { success: true };
        } catch (error) {
            console.error('Error deleting session:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('storage:delete-all-sessions', async () => {
        try {
            storage.deleteAllSessions();
            return { success: true };
        } catch (error) {
            console.error('Error deleting all sessions:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ LIMITS ============
    ipcMain.handle('storage:get-today-limits', async () => {
        try {
            return { success: true, data: storage.getTodayLimits() };
        } catch (error) {
            console.error('Error getting today limits:', error);
            return { success: false, error: error.message };
        }
    });

    // ============ CLEAR ALL ============
    ipcMain.handle('storage:clear-all', async () => {
        try {
            storage.clearAllData();
            return { success: true };
        } catch (error) {
            console.error('Error clearing all data:', error);
            return { success: false, error: error.message };
        }
    });
}

function setupGeneralIpcHandlers() {
    ipcMain.handle('get-app-version', async () => {
        return app.getVersion();
    });

    ipcMain.handle('get-display-sources', async () => {
        try {
            const { desktopCapturer, screen, systemPreferences } = require('electron');

            // On macOS, desktopCapturer.getSources throws "Failed to get sources"
            // when Screen Recording permission has not been granted. Detect that
            // up front so the UI can tell the user instead of silently showing
            // only the default display.
            let screenPermission = 'unknown';
            if (process.platform === 'darwin' && typeof systemPreferences.getMediaAccessStatus === 'function') {
                try {
                    screenPermission = systemPreferences.getMediaAccessStatus('screen');
                } catch (e) {
                    screenPermission = 'unknown';
                }
                console.log(`[display-sources] macOS Screen Recording permission = ${screenPermission}`);
            }

            // getSources can transiently fail right after launch / on first call.
            // Retry a couple of times with a lightweight options set (no
            // thumbnails) which is more reliable for enumeration.
            const getSourcesWithRetry = async () => {
                let lastErr;
                for (let attempt = 1; attempt <= 3; attempt++) {
                    try {
                        return await desktopCapturer.getSources({
                            types: ['screen'],
                            thumbnailSize: { width: 0, height: 0 },
                            fetchWindowIcons: false,
                        });
                    } catch (e) {
                        lastErr = e;
                        console.warn(`[display-sources] getSources attempt ${attempt} failed: ${e.message}`);
                        await new Promise(r => setTimeout(r, 250));
                    }
                }
                throw lastErr;
            };

            const [sources, displays] = await Promise.all([
                getSourcesWithRetry(),
                Promise.resolve(screen.getAllDisplays()),
            ]);
            console.log(
                `[display-sources] desktopCapturer screens=${sources.length}, screen.getAllDisplays()=${displays.length}`
            );
            console.log(
                '[display-sources] getSources: ' +
                    sources.map(s => `{id=${s.id} display_id=${s.display_id} name=${s.name}}`).join(', ')
            );
            console.log(
                '[display-sources] getAllDisplays: ' +
                    displays
                        .map(d => `{id=${d.id} internal=${d.internal} bounds=${d.bounds.width}x${d.bounds.height}}`)
                        .join(', ')
            );
            const displayById = new Map(displays.map(d => [String(d.id), d]));
            const data = sources.map((s, i) => {
                const display = displayById.get(String(s.display_id));
                let name;
                if (display) {
                    const { width, height } = display.bounds;
                    const tag = display.internal ? 'Built-in' : 'External';
                    const label = display.label && display.label !== s.name ? display.label : null;
                    name = label
                        ? `${tag}: ${label} (${width}×${height})`
                        : `${tag}: ${s.name} (${width}×${height})`;
                } else {
                    name = s.name || `Display ${i + 1}`;
                }
                // Use display_id as the stable identifier for the dropdown value.
                // desktopCapturer source ids ("screen:1:0") are NOT stable across
                // getSources() calls / reconnects, but display_id maps to
                // screen.getAllDisplays().id and stays stable. Fall back to the
                // source id only when display_id is unavailable.
                const stableId = s.display_id ? String(s.display_id) : s.id;
                return { index: i, name, id: stableId, sourceId: s.id, displayId: s.display_id };
            });
            return { success: true, data, permission: screenPermission };
        } catch (error) {
            console.error('Error getting display sources:', error);
            // Best-effort fallback: even if desktopCapturer failed, screen module
            // can still enumerate monitors. Offer them so the dropdown is not
            // stuck on a single default entry. Capture itself still needs the
            // permission, but at least the user sees what exists.
            let fallbackData = [];
            let permission = 'unknown';
            try {
                const { screen, systemPreferences } = require('electron');
                if (process.platform === 'darwin' && typeof systemPreferences.getMediaAccessStatus === 'function') {
                    permission = systemPreferences.getMediaAccessStatus('screen');
                }
                const displays = screen.getAllDisplays();
                fallbackData = displays.map((d, i) => {
                    const { width, height } = d.bounds;
                    const tag = d.internal ? 'Built-in' : 'External';
                    return {
                        index: i,
                        name: `${tag}: ${d.label || 'Display'} (${width}\u00d7${height})`,
                        id: String(d.id),
                        sourceId: null,
                        displayId: String(d.id),
                    };
                });
            } catch (e) {
                /* ignore */
            }
            return {
                success: false,
                error: error.message,
                permission,
                data: fallbackData,
                needsScreenPermission: process.platform === 'darwin' && permission !== 'granted',
            };
        }
    });

    ipcMain.handle('open-screen-recording-settings', async () => {
        try {
            if (process.platform === 'darwin') {
                const { shell } = require('electron');
                await shell.openExternal(
                    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
                );
                return { success: true };
            }
            return { success: false, error: 'not macOS' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('quit-application', async event => {
        try {
            stopMacOSAudioCapture();
            app.quit();
            return { success: true };
        } catch (error) {
            console.error('Error quitting application:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('open-external', async (event, url) => {
        try {
            await shell.openExternal(url);
            return { success: true };
        } catch (error) {
            console.error('Error opening external URL:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.on('update-keybinds', (event, newKeybinds) => {
        if (mainWindow) {
            // Also save to storage
            storage.setKeybinds(newKeybinds);
            updateGlobalShortcuts(newKeybinds, mainWindow, sendToRenderer, geminiSessionRef);
        }
    });

    // Debug logging from renderer
    ipcMain.on('log-message', (event, msg) => {
        console.log(msg);
    });
}
