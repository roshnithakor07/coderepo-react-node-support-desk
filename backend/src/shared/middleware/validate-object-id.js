import { AppError } from "../errors/app-error.js";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

// Used with router.param so malformed ids are rejected before they reach the database.
export function validateObjectIdParam(request, response, next, value, name) {
    if (!OBJECT_ID_PATTERN.test(value)) return next(new AppError(400, "INVALID_ID", `"${name}" is not a valid id.`));
    next();
}
