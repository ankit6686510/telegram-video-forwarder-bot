declare module 'input' {
    export function text(label: string, options?: any): Promise<string>;
    export function password(label: string, options?: any): Promise<string>;
    export function confirm(label: string, options?: any): Promise<boolean>;
    export function select(label: string, options: string[], defaultOption?: string): Promise<string>;
    export function checkboxes(label: string, options: string[], defaultOptions?: string[]): Promise<string[]>;
}
