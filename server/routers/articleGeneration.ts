import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { generateArticle, getGenerationResult } from "../services/articleGenerator";
import { reviseArticle } from "../services/articleRevision";
import { getUserGenerationHistory, getAllGenerationHistory, deleteGenerationHistory } from "../db/articleGeneration";
import * as blogDb from "../blogDb";

export const articleGenerationRouter = router({
  /**
   * Generate article from URL or text
   */
  generate: protectedProcedure
    .input(
      z.object({
        inputType: z.enum(["url", "text"]),
        inputContent: z.string().min(1, "Input content is required"),
        targetLanguage: z.string().optional().default("zh-TW"),
        style: z.string().optional().default("analysis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const generationId = await generateArticle({
          userId: ctx.user.id,
          inputType: input.inputType,
          inputContent: input.inputContent,
          targetLanguage: input.targetLanguage,
          style: input.style,
        });

        return { generationId, success: true };
      } catch (error) {
        console.error("Error generating article:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate article",
        });
      }
    }),

  /**
   * Get generation result by ID
   */
  getResult: protectedProcedure
    .input(z.object({ generationId: z.number() }))
    .query(async ({ input }) => {
      const result = await getGenerationResult(input.generationId);
      
      if (!result) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generation not found",
        });
      }

      return result;
    }),

  /**
   * Get user's generation history
   */
  myHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional().default(20),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      return await getUserGenerationHistory(ctx.user.id, input.limit, input.offset);
    }),

  /**
   * Get all generation history (admin only)
   */
  allHistory: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Admin access required",
        });
      }

      return await getAllGenerationHistory(input.limit, input.offset);
    }),

  /**
   * Revise article with AI assistance
   */
  revise: protectedProcedure
    .input(
      z.object({
        originalTitle: z.string(),
        originalContent: z.string(),
        originalExcerpt: z.string(),
        revisionRequest: z.string().min(1, "Revision request is required"),
        targetLanguage: z.string().optional().default("zh-TW"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const result = await reviseArticle({
          originalTitle: input.originalTitle,
          originalContent: input.originalContent,
          originalExcerpt: input.originalExcerpt,
          revisionRequest: input.revisionRequest,
          targetLanguage: input.targetLanguage,
        });

        return result;
      } catch (error) {
        console.error("Error revising article:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to revise article",
        });
      }
    }),

  /**
   * Delete generation history
   */
  deleteHistory: protectedProcedure
    .input(z.object({ generationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      // Check if user owns this generation or is admin
      const generation = await getGenerationResult(input.generationId);
      
      if (!generation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generation not found",
        });
      }

      if (generation.userId !== ctx.user.id && ctx.user.role !== "admin") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this generation",
        });
      }

      await deleteGenerationHistory(input.generationId);
      return { success: true };
    }),

  /**
   * Save generated article as draft post
   */
  saveAsDraft: protectedProcedure
    .input(
      z.object({
        generationId: z.number(),
        categoryId: z.number().optional(),
        tags: z.array(z.number()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const generation = await getGenerationResult(input.generationId);

      if (!generation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Generation not found",
        });
      }

      if (generation.status !== "completed") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generation is not completed yet",
        });
      }

      if (!generation.generatedTitle || !generation.generatedContent) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Generated content is missing",
        });
      }

      // Create post as draft
      const postId = await blogDb.createPost({
        title: generation.generatedTitle,
        slug: generation.generatedSlug || `article-${Date.now()}`,
        excerpt: generation.generatedExcerpt || "",
        content: generation.generatedContent,
        featuredImage: null,
        categoryId: input.categoryId || null,
        status: "draft",
        publishedAt: null,
        viewCount: 0,
        authorId: ctx.user.id,
        dataSource: "ai-generated",
        relatedCardIds: null,
        dataSnapshot: null,
        metaTitle: generation.generatedTitle,
        metaDescription: generation.generatedExcerpt || null,
        metaKeywords: null,
      });

      // Update generation with post ID
      const { updateGenerationStatus } = await import("../db/articleGeneration");
      await updateGenerationStatus(input.generationId, { postId });

      return { postId, success: true };
    }),
});
