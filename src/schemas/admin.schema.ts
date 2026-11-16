/**
 * Admin input rules.
 * Creating an admin uses the same account fields as registration.
 * Updating a user also allows role, which normal profile edits do not.
 */
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

// Same body as register. The controller sets role to admin itself.
export const createAdminSchema = registerSchema;

const objectIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid user id");

// Used by get and delete, which only need the user id from the URL.
export const adminUserIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

// An admin may change profile fields or move an account between user and admin.
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
