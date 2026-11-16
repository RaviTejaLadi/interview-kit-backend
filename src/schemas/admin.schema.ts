import { z } from "zod";
import {
  bioSchema,
  dobSchema,
  firstNameSchema,
  lastNameSchema,
  phoneNumberSchema,
  registerSchema,
  userNameSchema,
} from "./auth.schema";

export const createAdminSchema = registerSchema;

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid user id");

export const adminUserIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const adminUpdateUserSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
  body: z
    .object({
      firstName: firstNameSchema.optional(),
      lastName: lastNameSchema.optional(),
      userName: userNameSchema.optional(),
      phoneNumber: phoneNumberSchema.optional(),
      dob: dobSchema.optional(),
      bio: bioSchema.optional(),
      role: z.enum(["user", "admin"]).optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "At least one field is required",
    }),
});
