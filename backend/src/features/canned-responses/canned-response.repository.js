import { CannedResponse } from "./canned-response.model.js";

export const cannedResponseRepository = {
    findVisible: (userId) =>
        CannedResponse.find({ $or: [{ isGlobal: true }, { createdBy: userId }] })
            .sort({ category: 1, title: 1 })
            .lean(),
    findById: (id) => CannedResponse.findById(id),
    create: (input) => CannedResponse.create(input),
    remove: (id) => CannedResponse.findByIdAndDelete(id).lean(),
};
