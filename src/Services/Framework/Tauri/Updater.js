import { Tauri } from './Tauri.js';
// import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

const Updater = {
    async check(onUserClick = false) {
        try {
            const update = false;
            // const update = await check();
            
            if (update) {
                const yes = await Tauri.services.notify(
                    `Chamber ${update.version} is available!\n\nRelease notes: ${update.body}`, 
                    { 
                        title: 'Update Available',
                        okLabel: 'Update',
                        cancelLabel: 'Cancel'
                    }, 
                    true 
                );

                if (yes) {
                    let downloaded = 0;
                    let contentLength = 0;

                    await update.downloadAndInstall((event) => {
                        switch (event.event) {
                            case 'Started':
                                contentLength = event.data.contentLength;
                                console.log(`Started downloading ${contentLength} bytes`);
                                break;
                            case 'Progress':
                                downloaded += event.data.chunkLength;
                                console.log(`Downloaded ${downloaded} from ${contentLength}`);
                                break;
                            case 'Finished':
                                console.log('Download finished');
                                break;
                        }
                    });

                    console.log('Update installed');
                    await relaunch();
                }
            } else if (onUserClick) {
                await Tauri.services.notify('You are on the latest version.', { 
                    title: 'No Update Available' 
                });
            }
        } catch (error) {
            console.error('[Updater] Check failed:', error);
            if (onUserClick) {
                throw error;
            }
        }
        
        return Tauri;
    }
};

// --- Auto-Register ---
Tauri.register('updater', Updater);

export default Updater;