export interface Provider {
    type: string;
    instanceIndex: number;
    authenticated: boolean;
    accountInfo?: {
        name: string;
        email: string;
    };
}

export interface AddProviderRequest {
    providerType: string;
    credentials: {
        appKey: string;
        appSecret: string;
    };
}

export interface RemoveProviderRequest {
    providerType: string;
    instanceIndex: number;
}

export interface AddProviderResponse {
    instanceIndex?: number;
}

export type StatusType = 'info' | 'success' | 'error'; 