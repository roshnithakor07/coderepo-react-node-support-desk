import { AppError } from "../../shared/errors/app-error.js";
import { cannedResponseRepository } from "./canned-response.repository.js";

export const cannedResponseService = {
    list(actor) {
        return cannedResponseRepository.findVisible(actor.id);
    },

    create(input, actor) {
        const isGlobal = actor.role === "admin" ? Boolean(input.isGlobal ?? true) : false;
        return cannedResponseRepository.create({
            title: input.title,
            body: input.body,
            category: input.category || "general",
            createdBy: actor.id,
            isGlobal,
        });
    },

    async remove(id, actor) {
        const response = await cannedResponseRepository.findById(id);
        if (!response) throw new AppError(404, "CANNED_RESPONSE_NOT_FOUND", "Canned response not found.");
        const isOwner = String(response.createdBy) === actor.id;
        if (!isOwner && actor.role !== "admin") {
            throw new AppError(403, "FORBIDDEN", "You cannot delete this canned response.");
        }
        await cannedResponseRepository.remove(id);
    },
};
