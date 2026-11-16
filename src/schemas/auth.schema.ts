/**
 * Account input rules.
 * These run before the auth controller. The same field rules are reused
 * by the admin update form so a name or phone number is checked once.
 */
import { z } from "zod";

// Shared profile rules. Exported so the admin schema can reuse them.
export const firstNameSchema = z
  .string({
    required_error: "First name is required.",
    invalid_type_error: "First name must be text.",
  })
  .trim()
  .min(3, "First name must be at least 3 characters.")
  .max(60, "First name cannot exceed 60 characters.");

export const lastNameSchema = z
  .string({
    required_error: "Last name is required.",
    invalid_type_error: "Last name must be text.",
  })
  .trim()
  .min(3, "Last name must be at least 3 characters.")
  .max(60, "Last name cannot exceed 60 characters.");

export const userNameSchema = z
  .string({
    required_error: "Username is required.",
    invalid_type_error: "Username must be text.",
  })
  .trim()
  .min(2, "Username must be at least 2 characters.")
  .max(60, "Username cannot exceed 60 characters.");

export const phoneNumberSchema = z
  .string({
    required_error: "Phone number is required.",
    invalid_type_error: "Phone number must be text.",
  })
  .regex(/^[6-9]\d{9}$/, "Please enter a valid 10-digit phone number.");

// Rejects dates that look formatted but are not real, such as 2024-02-31.
export const dobSchema = z
  .string({
    required_error: "Date of birth is required.",
    invalid_type_error: "Date of birth must be text.",
  })
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be in YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Please enter a valid date of birth.");

export const bioSchema = z
  .string({
    required_error: "Bio is required.",
    invalid_type_error: "Bio must be text.",
  })
  .trim()
  .min(2, "Bio must be at least 2 characters.")
  .max(250, "Bio cannot exceed 250 characters.");

// New account. Role is not accepted here, so a caller cannot register as admin.
export const registerSchema = z.object({
  body: z.object({
    firstName: firstNameSchema,
    lastName: lastNameSchema,
    userName: userNameSchema,
    email: z
      .string({
        required_error: "Email address is required.",
        invalid_type_error: "Email address must be text.",
      })
      .email("Please enter a valid email address."),
    password: z
      .string({
        required_error: "Password is required.",
        invalid_type_error: "Password must be text.",
      })
      .min(6, "Password must be at least 6 characters.")
      .max(100, "Password cannot exceed 100 characters."),
    phoneNumber: phoneNumberSchema,
    dob: dobSchema,
    bio: bioSchema.optional(),
  }),
});

// Login only needs the two fields used to find and check the account.
export const loginSchema = z.object({
  body: z.object({
    email: z
      .string({
        required_error: "Email address is required.",
        invalid_type_error: "Email address must be text.",
      })
      .email("Please enter a valid email address."),
    password: z
      .string({
        required_error: "Password is required.",
        invalid_type_error: "Password must be text.",
      })
      .min(1, "Password is required."),
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
      message: "At least one profile field is required to update your profile.",
    }),
});

// The current password is required so a stolen access token cannot change the password alone.
export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z
      .string({
        required_error: "Current password is required.",
        invalid_type_error: "Current password must be text.",
      })
      .min(1, "Current password is required."),
    newPassword: z
      .string({
        required_error: "New password is required.",
        invalid_type_error: "New password must be text.",
      })
      .min(6, "New password must be at least 6 characters.")
      .max(100, "New password cannot exceed 100 characters."),
  }),
});

// The refresh token may arrive in the JSON body or in the cookie, so the body field is optional.
export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z
      .string({
        invalid_type_error: "Refresh token must be text.",
      })
      .optional(),
  }),
});
