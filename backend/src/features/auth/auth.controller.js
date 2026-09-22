import { z } from "zod";
import { authService } from "./auth.service.js";

const registerSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(160),
        password: z.string().min(8).max(100),
        role: z.enum(["admin", "agent", "customer"]).optional(),
    })
    .strict();

const loginSchema = z
    .object({
        email: z.string().trim().email().max(160),
        password: z.string().min(1),
    })
    .strict();

export async function register(request, response, next) {
    try {
        const input = registerSchema.parse(request.body);
        const result = await authService.register(input);
        response.status(201).json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function login(request, response, next) {
    try {
        const { email, password } = loginSchema.parse(request.body);
        const result = await authService.login(email, password);
        response.json({ data: result });
    } catch (error) {
        next(error);
    }
}

export async function logout(request, response, next) {
    try {
        const authorization = request.get("authorization") || "";
        const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
        if (token) await authService.logout(token);
        response.json({ data: { success: true } });
    } catch (error) {
        next(error);
    }
}

export async function me(request, response, next) {
    try {
        response.json({ data: request.user });
    } catch (error) {
        next(error);
    }
}
