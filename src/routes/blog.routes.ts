/**
 * Blog routes at /api/v1/blogs.
 * List and read-by-slug are public.
 * Create requires login. Update and delete are admin-only.
 */
import { Router } from "express";
import {
  createBlog,
  getBlogs,
  getBlogBySlug,
  updateBlog,
  deleteBlog,
} from "../controllers/blog.controller";
import { authorize, protect } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  createBlogSchema,
  getBlogsSchema,
  getBlogBySlugSchema,
  updateBlogSchema,
  blogIdSchema,
} from "../schemas/blog.schema";

const router = Router();

router.get("/", validate(getBlogsSchema), getBlogs);
router.get("/:slug", validate(getBlogBySlugSchema), getBlogBySlug);

router.post("/", protect, validate(createBlogSchema), createBlog);
router.patch(
  "/:id",
  protect,
  authorize("admin"),
  validate(updateBlogSchema),
  updateBlog
);
router.delete(
  "/:id",
  protect,
  authorize("admin"),
  validate(blogIdSchema),
  deleteBlog
);

export default router;
