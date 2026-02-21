import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getAllTemplates, getTemplate, applyTemplate } from "../services/articleTemplates";
import { analyzeSEO, generateMetaDescription } from "../services/seoAnalyzer";

export const templatesRouter = router({
  /**
   * Get all available article templates
   */
  list: publicProcedure.query(async () => {
    return getAllTemplates();
  }),

  /**
   * Get a specific template by ID
   */
  getById: publicProcedure
    .input(z.object({
      templateId: z.string(),
    }))
    .query(async ({ input }) => {
      const template = getTemplate(input.templateId);
      if (!template) {
        throw new Error("Template not found");
      }
      return template;
    }),

  /**
   * Apply template with variables
   */
  applyTemplate: publicProcedure
    .input(z.object({
      templateId: z.string(),
      variables: z.record(z.string(), z.string()),
    }))
    .mutation(async ({ input }) => {
      const template = getTemplate(input.templateId);
      if (!template) {
        throw new Error("Template not found");
      }
      
      // Convert Record<string, unknown> to Record<string, string>
      const variables: Record<string, string> = {};
      for (const [key, value] of Object.entries(input.variables)) {
        variables[key] = String(value);
      }
      
      const content = applyTemplate(template, variables);
      return {
        content,
        template: template.name
      };
    }),

  /**
   * Analyze article for SEO
   */
  analyzeSEO: publicProcedure
    .input(z.object({
      title: z.string(),
      content: z.string(),
      metaDescription: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return analyzeSEO(input.title, input.content, input.metaDescription || "");
    }),

  /**
   * Generate meta description from content
   */
  generateMetaDesc: publicProcedure
    .input(z.object({
      content: z.string(),
      maxLength: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return {
        metaDescription: generateMetaDescription(input.content, input.maxLength)
      };
    }),
});
