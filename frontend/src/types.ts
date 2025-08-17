// App.tsx
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

// App.tsx, components/StatusAlert.tsx
export type StatusType = 'info' | 'success' | 'error'; 

// App.tsx, components/ProviderItem.tsx
export interface Provider {
    type: string;
    instanceIndex: number;
    authenticated: boolean;
    accountInfo?: {
        name: string;
        email: string;
    };
}

// PhotoGallery.tsx
export interface PhotoMetadata {
    id: string;
    name: string;
    path: string;
    date_taken: Date;
    size: number;
    providerType: string;
    instanceIndex: number;
    hash?: string;
    thumbnail?: {
        data: string;
        mimeType: string;
    } | {
        error: string;
    };
}