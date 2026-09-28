import { Router } from "express";
import { requireAuth } from "../../shared/middleware/auth.js";
import { rateLimit } from "../../shared/middleware/rate-limit.js";
import { login, logout, me, register } from "./auth.controller.js";

export const authRouter = Router();

const loginRateLimit = rateLimit({ windowSeconds: 60, max: 10, keyPrefix: "login" });
const registerRateLimit = rateLimit({ windowSeconds: 600, max: 10, keyPrefix: "register" });

authRouter.post("/register", registerRateLimit, register);
authRouter.post("/login", loginRateLimit, login);
authRouter.post("/logout", requireAuth, logout);
authRouter.get("/me", requireAuth, me);
