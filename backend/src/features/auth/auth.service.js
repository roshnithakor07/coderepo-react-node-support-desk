import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getConfig } from "../../shared/config/index.js";
import { getRedis } from "../../shared/config/redis.js";
import { AppError } from "../../shared/errors/app-error.js";
import { authRepository } from "./auth.repository.js";

function toPublicUser(user) {
    return {
        id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || "",
        isActive: user.isActive,
        createdAt: user.createdAt,
    };
}

function signToken(user) {
    const config = getConfig();
    return jwt.sign({ sub: String(user._id), role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export const authService = {
    async register(input) {
        const existing = await authRepository.findByEmail(input.email);
        if (existing) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
        const passwordHash = await bcrypt.hash(input.password, 10);
        const user = await authRepository.create({
            name: input.name,
            email: input.email,
            password: passwordHash,
            role: input.role || "customer",
        });
        const token = signToken(user);
        return { user: toPublicUser(user), token };
    },

    async login(email, password) {
        const user = await authRepository.findByEmail(email);
        if (!user || !user.isActive) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        const matches = await bcrypt.compare(password, user.password);
        if (!matches) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        const token = signToken(user);
        return { user: toPublicUser(user), token };
    },

    async logout(token) {
        try {
            const config = getConfig();
            const decoded = jwt.decode(token);
            if (!decoded?.exp) return;
            const ttlSeconds = decoded.exp - Math.floor(Date.now() / 1000);
            if (ttlSeconds > 0) {
                await getRedis().set(`token-blacklist:${token}`, "1", "EX", ttlSeconds);
            }
        } catch {
            // best-effort blacklist; token will simply expire naturally otherwise
        }
    },

    async authenticate(token) {
        const config = getConfig();
        let payload;
        try {
            payload = jwt.verify(token, config.jwtSecret);
        } catch {
            throw new AppError(401, "INVALID_TOKEN", "Your session is invalid or has expired.");
        }
        const blacklisted = await getRedis().get(`token-blacklist:${token}`);
        if (blacklisted) throw new AppError(401, "INVALID_TOKEN", "Your session is invalid or has expired.");
        const user = await authRepository.findById(payload.sub);
        if (!user || !user.isActive) throw new AppError(401, "INVALID_TOKEN", "Your session is invalid or has expired.");
        return toPublicUser(user);
    },

    toPublicUser,
};
