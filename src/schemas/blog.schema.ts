/**
 * Blog request rules.
 * Checked before a blog is saved, listed, or loaded by id/slug.
 */
import { z } from "zod";

const objectIdSchema = z
  .string({
    required_error: "Id is required.",
    invalid_type_error: "Id must be text.",
  })
  .regex(/^[a-fA-F0-9]{24}$/, "Please provide a valid id.");

const titleSchema = z
  .string({
    required_error: "Title is required.",
    invalid_type_error: "Title must be text.",
  })
  .trim()
  .min(5, "Title must be at least 5 characters.")
  .max(120, "Title cannot exceed 120 characters.");

const descriptionSchema = z
  .string({
    required_error: "Description is required.",
    invalid_type_error: "Description must be text.",
  })
  .trim()
  .min(20, "Description must be at least 20 characters.")
  .max(300, "Description cannot exceed 300 characters.");

const blogBodySchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  date: z.coerce.date({
    required_error: "Date is required.",
    invalid_type_error: "Date must be a valid date.",
  }),
  readTime: z
    .string({
      required_error: "Read time is required.",
      invalid_type_error: "Read time must be text.",
    })
    .trim()
    .min(1, "Read time is required."),
  content: z
    .string({
      required_error: "Content is required.",
      invalid_type_error: "Content must be text.",
    })
    .trim()
    .min(1, "Content is required."),
  status: z
    .enum(["draft", "published", "scheduled"], {
      errorMap: () => ({
        message: "Status must be draft, published, or scheduled.",
      }),
    })
    .optional()
    .default("draft"),
  coverImageUrl: z.string().url("Cover image must be a valid URL.").optional(),
  tags: z.array(z.string().trim().min(1)).optional(),
  categoryId: z.string().trim().optional(),
  seoTitle: z.string().trim().optional(),
  seoDescription: z.string().trim().optional(),
});

export const createBlogSchema = z.object({
  body: blogBodySchema,
});

const updateBlogBodySchema = blogBodySchema.partial().extend({
  slug: z
    .string({ invalid_type_error: "Slug must be text." })
    .trim()
    .min(1, "Slug is required.")
    .optional(),
  authorId: z
    .string({ invalid_type_error: "Author id must be text." })
    .trim()
    .min(1, "Author id is required.")
    .optional(),
  views: z
    .number({ invalid_type_error: "Views must be a number." })
    .int()
    .nonnegative()
    .optional(),
  likes: z
    .number({ invalid_type_error: "Likes must be a number." })
    .int()
    .nonnegative()
    .optional(),
  publishedAt: z.coerce
    .date({ invalid_type_error: "Published at must be a valid date." })
    .optional()
    .nullable(),
});

export const updateBlogSchema = z.object({
  body: updateBlogBodySchema.refine(
    (body) => Object.keys(body).length > 0,
    { message: "Provide at least one field to update." }
  ),
  params: z.object({
    id: objectIdSchema,
  }),
});

export const blogIdSchema = z.object({
  params: z.object({
    id: objectIdSchema,
  }),
});

export const getBlogBySlugSchema = z.object({
  params: z.object({
    slug: z
      .string({
        required_error: "Slug is required.",
        invalid_type_error: "Slug must be text.",
      })
      .trim()
      .min(1, "Slug is required."),
  }),
});

export const getBlogsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    status: z.enum(["draft", "published", "scheduled"]).optional(),
    search: z
      .string({ invalid_type_error: "Search must be text." })
      .trim()
      .max(120, "Search cannot exceed 120 characters.")
      .optional(),
  }),
});
