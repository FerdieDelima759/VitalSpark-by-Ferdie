// ===========================
// Auth Type Definitions
// ===========================

export interface LoginCredentials {
    email: string;
    password: string;
}

export interface SignUpCredentials {
    email: string;
    password: string;
    fullName?: string;
}

export interface ResetPasswordRequest {
    email: string;
}

export interface UpdatePasswordRequest {
    token: string;
    newPassword: string;
}

export interface AuthResponse {
    success: boolean;
    message: string;
    data?: any;
    error?: string;
}

export interface ApiError {
    message: string;
    code?: string;
    statusCode?: number;
}

