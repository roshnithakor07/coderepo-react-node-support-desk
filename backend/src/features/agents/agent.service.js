import bcrypt from "bcryptjs";
import { AppError } from "../../shared/errors/app-error.js";
import { authRepository } from "../auth/auth.repository.js";
import { agentRepository } from "./agent.repository.js";

export const agentService = {
    listWithWorkload() {
        return authRepository.findAgentsWithWorkload();
    },

    async create(input) {
        const existing = await agentRepository.findByEmail(input.email);
        if (existing) throw new AppError(409, "EMAIL_TAKEN", "An account with this email already exists.");
        const passwordHash = await bcrypt.hash(input.password, 10);
        const agent = await agentRepository.create({
            name: input.name,
            email: input.email,
            password: passwordHash,
            role: "agent",
            avatar: input.avatar || "",
        });
        return {
            id: String(agent._id),
            name: agent.name,
            email: agent.email,
            role: agent.role,
            avatar: agent.avatar,
            isActive: agent.isActive,
            createdAt: agent.createdAt,
        };
    },

    async setActive(id, isActive) {
        const agent = await agentRepository.setActive(id, isActive);
        if (!agent) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found.");
        return agent;
    },
};
