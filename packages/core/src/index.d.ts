export interface AnalysisResult {
    critical: {
        id: string;
        description: string;
        value: string;
    }[];
    warning: {
        id: string;
        description: string;
        value: string;
    }[];
    info: {
        id: string;
        description: string;
        value: string;
    }[];
}
export declare function analyzeFile(buf: Uint8Array, mime?: string, name?: string): Promise<AnalysisResult>;
export declare function sanitizeFile(buf: Uint8Array, opts?: any): Promise<Uint8Array>;
