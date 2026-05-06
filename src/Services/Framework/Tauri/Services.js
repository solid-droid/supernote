import { Tauri } from './Tauri.js';
import { open, ask, message } from '@tauri-apps/plugin-dialog';

const Services = {
    async import(options = {}) {
        return await open({
            multiple: options.multiple ?? false,
            directory: options.directory ?? false
        });
    },

    async export(data, filename = 'data.json') {
        console.log(`Exporting ${filename}...`, data);
        return { success: true };
    },

    async notify(msg, options = {}, question = false) {
        const config = { 
            title: options.title,
            kind: options.kind || 'info',
            okLabel: options.okLabel || (question ? 'Yes' : 'OK'),
            cancelLabel: options.cancelLabel || (question ? 'No' : 'Cancel')
        };

        if (question) {
            return await ask(msg, config);
        }
        return await message(msg, config);
    }
};

// --- Auto-Register ---
Tauri.register('services', Services);

export default Services;