import { AppError } from "../errors/app-error.js";

export function requireRole(...roles) {
    return (request, response, next) => {
        if (!request.user) return next(new AppError(401, "AUTH_REQUIRED", "Sign in to continue."));
        if (!roles.includes(request.user.role)) {
            return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
        }
        next();
    };
}
