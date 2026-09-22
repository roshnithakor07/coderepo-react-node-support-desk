import { User } from "../auth/user.model.js";

export const webhookRepository = {
    findCustomerByEmail: (email) => User.findOne({ email, role: "customer" }).lean(),
    createCustomer: (input) => User.create(input),
};
