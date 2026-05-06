import { ITauri} from '../Tauri/types';
import { ILog } from '../Log/types';


declare global {
    // 1. External Libraries
    interface Window {
        $: any;
        jQuery: any;

        /** Global Namespace for your Framework */
        CHAMBER: {
            Tauri: ITauri;
            UI: IUI;
            Log: ILog;
        };

        __TAURI__: {
            core: {
                invoke(cmd: string, args?: any): Promise<any>;
            };
        };

        BABYLON: any; // Babylon.js global namespace
        BABYLON_HELPER: any; // Canvas global namespace

    }

    // Allow using $ and CHAMBER directly without 'window.'
    const $: any;
    const jQuery: any;
    const CHAMBER: {
        Tauri: ITauri;
        Log: ILog;
    };
}

export {};