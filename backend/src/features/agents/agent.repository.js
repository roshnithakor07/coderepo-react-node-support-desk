import { User } from "../auth/user.model.js";

export const agentRepository = {
    findAll: () => User.find({ role: "agent" }).sort({ createdAt: -1 }).lean(),
    findByEmail: (email) => User.findOne({ email }),
    create: (input) => User.create(input),
    setActive: (id, isActive) => User.findOneAndUpdate({ _id: id, role: "agent" }, { isActive }, { new: true }).lean(),
    setCategories: (id, categories) => User.findOneAndUpdate({ _id: id, role: "agent" }, { categories }, { new: true }).lean(),
};
