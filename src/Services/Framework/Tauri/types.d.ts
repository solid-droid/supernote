/**
 * System Services Plugin (Tauri-based)
 */
export interface ITauriServices {
    import(options?: { multiple?: boolean; directory?: boolean }): Promise<string[] | string | null>;
    export(data: any, filename?: string): Promise<{ success: boolean; path?: string }>;
    notify(msg: string, options?: any, question?: boolean): Promise<boolean | void>;
}

/**
 * Sidecar Plugin (Tauri-based)
 */
export interface ISidecarHandle {
    id: string;
    program: string;
    args: string[];
    command: any;
    child: {
        pid: number;
        write(data: string | Uint8Array | number[]): Promise<void>;
        kill(): Promise<void>;
    };
    pid: number;
    send(message: string | Uint8Array | number[] | Record<string, any>): Promise<void>;
    kill(): Promise<boolean>;
}

export interface ITauriSidecar {
    registerProgram(key: string, program: string): ITauriSidecar;
    listPrograms(): Array<{ key: string; program: string }>;
    spawn(data: {
        id?: string;
        engine?: string;
        program?: string;
        args?: string[];
        type?: string;
        msg?: string;
        env?: Record<string, string>;
        cwd?: string;
        encoding?: string;
        onMessage?: (line: string) => void;
        onError?: (err: any) => void;
        onExit?: (payload: { code: number | null; signal: number | null }) => void;
    }): Promise<ISidecarHandle>;
    bun(data?: any): Promise<ISidecarHandle>;
    python(data?: any): Promise<ISidecarHandle>;
    nodeJS(data?: any): Promise<ISidecarHandle>;
    get(id: string): ISidecarHandle | null;
    list(): Array<{ id: string; program: string; pid: number }>;
    send(id: string, message: string | Uint8Array | number[] | Record<string, any>): Promise<void>;
    send(message: string | Uint8Array | number[] | Record<string, any>): Promise<void>;
    kill(id?: string): Promise<boolean>;
    killAll(): Promise<boolean[]>;
    isRunning(id?: string): boolean;
    [key: string]: ISidecarHandle | any; // Allow Proxy access to instances by ID
}

/**
 * Updater Plugin (Tauri-based)
 */
export interface ITauriUpdater {
    check(onUserClick?: boolean): Promise<ITauri>;
}

/**
 * Main Tauri API Proxy
 */
export interface ITauri {
    window: any | null;
    env: {
        isMobile: boolean;
        isTauri: boolean;
        isDev: boolean;
    };
    register(name: string, plugin: any): ITauri;
    close(): ITauri;
    minimize(): ITauri;
    resize(width: number, height: number): Promise<ITauri>;
    
    // Registered Plugins
    services?: ITauriServices;
    sidecar?: ITauriSidecar;
    updater?: ITauriUpdater;

    [key: string]: any; // Catch-all for other dynamic plugins
}