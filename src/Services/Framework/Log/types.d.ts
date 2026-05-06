/**
 * Log and Performance Tracking Proxy
 */
export interface ILog {
    // 1. Core methods
    start(label: string): ILog;
    done(label: string): ILog;
    report(type?: string): Array<any>;
    clear(): ILog;
    
    // 2. The "Ghost" trap for dynamic methods (e.g. Log.info, Log.custom)
    // We use 'any' here to stop the "string is not assignable" conflict
    [key: string]: any; 
}