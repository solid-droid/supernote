import { ITauri} from '../Tauri/types';
import { ILog } from '../Log/types';


declare global {
    // 1. External Libraries
    interface Window {
        $: any;
        jQuery: any;

        /** Global Namespace for your Framework */
        Supernote: {
            Tauri: ITauri;
            Log: ILog;
        };

        Superhub: {
            Widgets: Record<string, Function>;
            cache: {
                byKey: Record<string, any>;
                bySlug: Record<string, any>;
                byAlias: Record<string, any>;
            };
            getDependency(reference?: string): any;
            getPlugins?: () => Record<string, any>;
        };

        __TAURI__: {
            core: {
                invoke(cmd: string, args?: any): Promise<any>;
            };
        };

        BABYLON: any; // Babylon.js global namespace
        BABYLON_HELPER: any; // Canvas global namespace

    }

    // Allow using globals directly without 'window.'
    const $: any;
    const jQuery: any;
    const Supernote: {
        Tauri: ITauri;
        Log: ILog;
    };
    const Superhub: {
        Widgets: Record<string, Function>;
        cache: {
            byKey: Record<string, any>;
            bySlug: Record<string, any>;
            byAlias: Record<string, any>;
        };
        getDependency(reference?: string): any;
        getPlugins?: () => Record<string, any>;
    };
}

export {};