/**
 * Account input rules.
 * These run before the auth controller. The same field rules are reused
 * by the admin update form so a name or phone number is checked once.
 */
import { z } from "zod";

// Shared profile rules. Exported so the admin schema can reuse them.
export const firstNameSchema = z
  .string()
  .trim()
  .min(3, "First Name must be at least 3 characters")
  .max(60, "First Name cannot exceed 60 characters");

export const lastNameSchema = z
  .string()
  .trim()
  .min(3, "Last Name must be at least 3 characters")
  .max(60, "Last Name cannot exceed 60 characters");

export const userNameSchema = z
  .string()
  .trim()
  .min(2, "Username must be at least 2 characters")
  .max(60, "Username cannot exceed 60 characters");

export const phoneNumberSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number");

// Rejects dates that look formatted but are not real, such as 2024-02-31.
export const dobSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Please enter a valid date of birth");

export const bioSchema = z
  .string()
  .trim()
  .min(2, "Bio must be at least 2 characters long")
  .max(250, "Bio cannot exceed 250 characters");

// New account. Role is not accepted here, so a caller cannot register as admin.
export const registerSchema = z.object({
  body: z.object({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    userName: userNameSchema,
    email: z.string().email("Invalid email address"),
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(100),
    phoneNumber: phoneNumberSchema,
    dob: dobSchema,
    bio: bioSchema.optional(),
  }),
});

// Login only needs the two fields used to find and check the account.
export const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
});

// Partial profile edit. At least one field is required so an empty patch does nothing.
export const updateProfileSchema = z.object({
  body: z
    .object({
      firstName: firstNameSchema.optional(),
      lastName: lastNameSchema.optional(),
      userName: userNameSchema.optional(),
      phoneNumber: phoneNumberSchema.optional(),
      dob: dobSchema.optional(),
      bio: bioSchema.optional(),
    })
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: "At least one profile field is required",
    }),
});

// The current password is required so a stolen access token cannot change the password alone.
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters")
      .max(100),
  }),
});

// The refresh token may arrive in the JSON body or in the cookie, so the body field is optional.
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().optional(),
  }),
});
