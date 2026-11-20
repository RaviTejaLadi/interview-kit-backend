/**
 * Blogs.
 * Authors create drafts or published blogs. Slugs are unique and used for public URLs.
 * Tags are indexed for search; title/description/content also support list search.
 */
import mongoose, { Document, Schema } from "mongoose";

export const BLOG_STATUSES = ["draft", "published", "scheduled"] as const;
export type BlogStatus = (typeof BLOG_STATUSES)[number];

export interface IBlog extends Document {
  title: string;
  description: string;
  date: Date;
  readTime: string;
  content: string;
  slug: string;
  authorId: string;
  status: BlogStatus;
  coverImageUrl?: string;
  tags?: string[];
  categoryId?: string;
  seoTitle?: string;
  seoDescription?: string;
  views: number;
  likes: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    date: {
      type: Date,
      required: [true, "Date is required"],
    },
    readTime: {
      type: String,
      required: [true, "Read time is required"],
      trim: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      index: true,
    },
    authorId: {
      type: String,
      required: [true, "Author is required"],
      index: true,
    },
    status: {
      type: String,
      enum: BLOG_STATUSES,
      default: "draft",
    },
    coverImageUrl: { type: String },
    tags: {
      type: [{ type: String, trim: true }],
      default: [],
      index: true,
    },
    categoryId: { type: String },
    seoTitle: { type: String },
    seoDescription: { type: String },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

blogSchema.index({ title: 1, description: 1 });
blogSchema.index({ tags: 1 });

export const Blog = mongoose.model<IBlog>("Blog", blogSchema);
