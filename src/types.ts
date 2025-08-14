// Type definitions for Cardcom Open Fields integration

export type SubmitResult = {
    IsSuccess: boolean;
    Description: string;
    ResponseCode?: number;
    message?: string;
    isError?: boolean;
    IsSessionClosed?: boolean;
    IsDeveloperError?: boolean;
    IsInputError?: boolean;
    InternalDealNumber?: number;
}

export type CheckoutFormProps = {
    loadingRef: React.RefObject<HTMLDivElement | null>;
    lowProfileCode: string;
}

export type SummaryProps = { 
    onContinue: () => void; 
}

// Message types for iframe communication
export type IframeMessage = {
    action: string;
    data?: Record<string, unknown>;
    field?: string;
    isValid?: boolean;
    message?: string;
    className?: string;
}

// Document structure for invoice/receipt generation
export type DocumentData = {
    Name: string;
    Email: string;
    IsSendByEmail: boolean;
    AddressLine1: string;
    AddressLine2: string;
    City: string;
    Mobile: string;
    Phone: string;
    Comments: string;
    IsVatFree: boolean;
    DepartmentId: number;
    ExternalId: string;
    IsAllowEditDocument: boolean;
    IsShowOnlyDocument: boolean;
    Language: string;
    DocumentTypeToCreate: string;
    AdvancedDocumentDefinition: {
        IsAutoCreateUpdateAccount: string;
        AccountForeignKey: string;
        SiteUniqueId: string;
        AccountID: number;
        IsLoadInfoFromAccountID: boolean;
    };
    Products: Array<{
        ProductID: string;
        Description: string;
        Quantity: number;
        UnitCost: number;
        TotalLineCost: number;
        IsVatFree: boolean;
    }>;
}
