/**
 * Blog actions.
 * Anyone can list and read blogs by slug.
 * Create requires login. Update and delete are admin-only.
 */
import { Request, Response } from "express";
import { Blog, IBlog } from "../models/blog.model";
import { ApiError, asyncHandler } from "../utils/ApiError";
import { ResponseStatus, sendResponse } from "../types/http-response";
import { generateSlug } from "../utils/slugify";

export const toPublicBlog = (blog: IBlog) => ({
  id: blog._id,
  title: blog.title,
  description: blog.description,
  date: blog.date,
  readTime: blog.readTime,
  content: blog.content,
  slug: blog.slug,
  authorId: blog.authorId,
  status: blog.status,
  coverImageUrl: blog.coverImageUrl ?? null,
  tags: blog.tags ?? [],
  categoryId: blog.categoryId ?? null,
  seoTitle: blog.seoTitle ?? null,
  seoDescription: blog.seoDescription ?? null,
  views: blog.views,
  likes: blog.likes,
  publishedAt: blog.publishedAt ?? null,
  createdAt: blog.createdAt,
  updatedAt: blog.updatedAt,
});

// POST /api/v1/blogs
export const createBlog = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Please log in to continue.");
  }

  const {
    title,
    description,
    date,
    readTime,
    content,
    status = "draft",
    coverImageUrl,
    tags,
    categoryId,
    seoTitle,
    seoDescription,
  } = req.body;

  const slug = generateSlug(title);
  const existingBlog = await Blog.findOne({ slug });
  if (existingBlog) {
    throw new ApiError(409, "A blog with this title already exists.");
  }

  const blog = await Blog.create({
    title,
    description,
    date,
    readTime,
    content,
    slug,
    status,
    coverImageUrl,
    tags,
    categoryId,
    seoTitle,
    seoDescription,
    authorId: req.user.userId,
    publishedAt: status === "published" ? date : undefined,
  });

  sendResponse(res, 201, {
    data: {
      blog: toPublicBlog(blog),
    },
    status: ResponseStatus.SUCCESS,
    message: "The blog has been created successfully.",
  });
});

const escapeRegex = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/v1/blogs?search=caching&status=published
export const getBlogs = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;
  const status = req.query.status as string | undefined;
  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";

  const query: Record<string, unknown> = {};
  if (status) query.status = status;

  if (search) {
    const pattern = escapeRegex(search);
    query.$or = [
      { title: { $regex: pattern, $options: "i" } },
      { description: { $regex: pattern, $options: "i" } },
      { content: { $regex: pattern, $options: "i" } },
      { tags: { $regex: pattern, $options: "i" } },
    ];
  }

  const [blogs, total] = await Promise.all([
    Blog.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit),
    Blog.countDocuments(query),
  ]);

  sendResponse(res, 200, {
    data: {
      blogs: blogs.map(toPublicBlog),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        search: search || null,
      },
    },
    status: ResponseStatus.SUCCESS,
    message: "Blogs have been retrieved successfully.",
  });
});

// GET /api/v1/blogs/:slug
export const getBlogBySlug = asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findOne({ slug: req.params.slug });
  if (!blog) {
    throw new ApiError(404, "Blog not found.");
  }

  sendResponse(res, 200, {
    data: {
      blog: toPublicBlog(blog),
    },
    status: ResponseStatus.SUCCESS,
    message: "The blog has been retrieved successfully.",
  });
});

// PATCH /api/v1/blogs/:id
export const updateBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    throw new ApiError(404, "Blog not found.");
  }

  const updates = { ...req.body };

  if (updates.title && updates.title !== blog.title && updates.slug === undefined) {
    updates.slug = generateSlug(updates.title);
  }

  if (updates.slug !== undefined || updates.title !== undefined) {
    const slugToCheck = updates.slug ?? blog.slug;
    const existing = await Blog.findOne({ slug: slugToCheck });
    if (existing && existing._id.toString() !== blog._id.toString()) {
      throw new ApiError(409, "A blog with this slug already exists.");
    }
  }

  if (
    updates.status === "published" &&
    blog.status !== "published" &&
    updates.publishedAt === undefined
  ) {
    updates.publishedAt = new Date();
  }

  const updatedBlog = await Blog.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  if (!updatedBlog) {
    throw new ApiError(404, "Blog not found.");
  }

  sendResponse(res, 200, {
    data: {
      blog: toPublicBlog(updatedBlog),
    },
    status: ResponseStatus.SUCCESS,
    message: "The blog has been updated successfully.",
  });
});

// DELETE /api/v1/blogs/:id
export const deleteBlog = asyncHandler(async (req: Request, res: Response) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog) {
    throw new ApiError(404, "Blog not found.");
  }

  await blog.deleteOne();

  sendResponse(res, 200, {
    data: null,
    status: ResponseStatus.SUCCESS,
    message: "The blog has been deleted successfully.",
  });
});
