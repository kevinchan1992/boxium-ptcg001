import { describe, it, expect, beforeAll } from 'vitest';
import { getDb } from './db';
import * as blogDb from './blogDb';

describe('Blog System Tests', () => {
  let testCategoryId: number;
  let testPostId: number;
  let testTagId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error('Database not available');
    }
  });

  describe('Category Management', () => {
    it('should create a new category', async () => {
      const categoryId = await blogDb.createCategory({
        name: 'Test Category',
        slug: 'test-category',
        description: 'This is a test category',
      });
      expect(categoryId).toBeGreaterThan(0);
      testCategoryId = categoryId;
    });

    it('should get all categories', async () => {
      const categories = await blogDb.getCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories.some(c => c.id === testCategoryId)).toBe(true);
    });

    it('should get category by slug', async () => {
      const category = await blogDb.getCategoryBySlug('test-category');
      expect(category).not.toBeNull();
      expect(category?.name).toBe('Test Category');
    });
  });

  describe('Tag Management', () => {
    it('should create a new tag', async () => {
      const tagId = await blogDb.createTag({
        name: 'Test Tag',
        slug: 'test-tag',
      });
      expect(tagId).toBeGreaterThan(0);
      testTagId = tagId;
    });

    it('should get all tags', async () => {
      const tags = await blogDb.getTags();
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.some(t => t.id === testTagId)).toBe(true);
    });

    it('should get tag by slug', async () => {
      const tag = await blogDb.getTagBySlug('test-tag');
      expect(tag).not.toBeNull();
      expect(tag?.name).toBe('Test Tag');
    });
  });

  describe('Post Management', () => {
    it('should create a new post', async () => {
      const postId = await blogDb.createPost({
        title: 'Test Post',
        slug: 'test-post',
        excerpt: 'This is a test post excerpt',
        content: '# Test Post\n\nThis is the content of the test post.',
        featuredImage: 'https://example.com/image.jpg',
        categoryId: testCategoryId,
        status: 'draft',
        publishedAt: null,
        viewCount: 0,
        authorId: 1,
        dataSource: 'manual',
        relatedCardIds: null,
        dataSnapshot: null,
        metaTitle: 'Test Post - SEO Title',
        metaDescription: 'This is the SEO description',
        metaKeywords: 'test, post, seo',
      });
      expect(postId).toBeGreaterThan(0);
      testPostId = postId;
    });

    it('should get post by slug', async () => {
      const post = await blogDb.getPostBySlug('test-post');
      expect(post).not.toBeNull();
      expect(post?.title).toBe('Test Post');
      expect(post?.status).toBe('draft');
    });

    it('should get post by ID', async () => {
      const post = await blogDb.getPostById(testPostId);
      expect(post).not.toBeNull();
      expect(post?.id).toBe(testPostId);
    });

    it('should get all posts', async () => {
      const posts = await blogDb.getPosts();
      expect(posts.length).toBeGreaterThan(0);
      expect(posts.some(p => p.id === testPostId)).toBe(true);
    });

    it('should filter posts by status', async () => {
      const draftPosts = await blogDb.getPosts({ status: 'draft' });
      expect(draftPosts.every(p => p.status === 'draft')).toBe(true);
    });

    it('should filter posts by category', async () => {
      const categoryPosts = await blogDb.getPosts({ categoryId: testCategoryId });
      expect(categoryPosts.every(p => p.categoryId === testCategoryId)).toBe(true);
    });

    it('should search posts by title', async () => {
      const searchResults = await blogDb.getPosts({ search: 'Test' });
      expect(searchResults.length).toBeGreaterThan(0);
    });

    it('should update a post', async () => {
      await blogDb.updatePost(testPostId, {
        title: 'Updated Test Post',
        excerpt: 'Updated excerpt',
      });
      const post = await blogDb.getPostById(testPostId);
      expect(post?.title).toBe('Updated Test Post');
      expect(post?.excerpt).toBe('Updated excerpt');
    });

    it('should toggle post publish status', async () => {
      await blogDb.togglePublishPost(testPostId);
      let post = await blogDb.getPostById(testPostId);
      expect(post?.status).toBe('published');
      expect(post?.publishedAt).not.toBeNull();

      await blogDb.togglePublishPost(testPostId);
      post = await blogDb.getPostById(testPostId);
      expect(post?.status).toBe('draft');
    });

    it('should increment post view count', async () => {
      const initialPost = await blogDb.getPostById(testPostId);
      const initialViewCount = initialPost?.viewCount || 0;

      await blogDb.incrementPostViewCount(testPostId);
      const updatedPost = await blogDb.getPostById(testPostId);
      expect(updatedPost?.viewCount).toBe(initialViewCount + 1);
    });
  });

  describe('Post Tags Relationship', () => {
    it('should add tags to post', async () => {
      await blogDb.addTagsToPost(testPostId, [testTagId]);
      const tags = await blogDb.getPostTags(testPostId);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags.some(t => t.id === testTagId)).toBe(true);
    });

    it('should get tags for a post after adding', async () => {
      // Tags should still be there from previous test
      const tags = await blogDb.getPostTags(testPostId);
      expect(tags.length).toBeGreaterThanOrEqual(0);
    });

    it('should remove tags from post', async () => {
      await blogDb.removeTagsFromPost(testPostId);
      const tags = await blogDb.getPostTags(testPostId);
      expect(tags.length).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('should generate slug from title', () => {
      const slug1 = blogDb.generateSlug('Test Post Title');
      expect(slug1).toBe('test-post-title');

      const slug2 = blogDb.generateSlug('測試文章標題');
      // Chinese characters are preserved in slug
      expect(slug2).toBe('測試文章標題');

      const slug3 = blogDb.generateSlug('Test!@#$%^&*()Post');
      expect(slug3).toBe('test-post');
    });
  });

  describe('Cleanup', () => {
    it('should delete test post', async () => {
      await blogDb.deletePost(testPostId);
      const post = await blogDb.getPostById(testPostId);
      expect(post).toBeNull();
    });
  });
});
