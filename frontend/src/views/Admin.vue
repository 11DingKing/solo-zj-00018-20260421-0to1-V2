<template>
  <div class="admin-page container">
    <h1 class="page-title mb-4">管理后台</h1>

    <div class="tabs flex gap-4 mb-4">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'categories' }"
        @click="activeTab = 'categories'"
      >
        板块管理
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'posts' }"
        @click="activeTab = 'posts'"
      >
        帖子管理
      </button>
    </div>

    <div v-if="error" class="alert alert-error mb-4">{{ error }}</div>

    <div v-if="activeTab === 'categories'">
      <div class="card mb-4">
        <div class="card-header">
          <h3>添加板块</h3>
        </div>
        <div class="card-body">
          <form @submit.prevent="handleAddCategory" class="form">
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">名称</label>
                <input
                  v-model="newCategory.name"
                  type="text"
                  class="form-input"
                  placeholder="板块名称"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">标识 (slug)</label>
                <input
                  v-model="newCategory.slug"
                  type="text"
                  class="form-input"
                  placeholder="英文标识，如 general"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">排序</label>
                <input
                  v-model.number="newCategory.order"
                  type="number"
                  class="form-input"
                  placeholder="数字越小越靠前"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">描述</label>
              <input
                v-model="newCategory.description"
                type="text"
                class="form-input"
                placeholder="板块描述（可选）"
              />
            </div>
            <div class="form-actions">
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="submittingCategory"
              >
                {{ submittingCategory ? "添加中..." : "添加板块" }}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>板块列表</h3>
        </div>
        <div class="card-body">
          <div v-if="loadingCategories" class="loading">
            <div class="spinner"></div>
          </div>

          <div
            v-else-if="categories.length === 0"
            class="text-center text-secondary py-4"
          >
            暂无板块
          </div>

          <div v-else class="category-table">
            <div
              v-for="category in categories"
              :key="category._id"
              class="category-row flex items-center justify-between p-3 border-b"
            >
              <div class="category-info flex-1">
                <div class="flex items-center gap-2">
                  <strong>{{ category.name }}</strong>
                  <span class="text-secondary text-sm"
                    >({{ category.slug }})</span
                  >
                  <span class="badge badge-primary"
                    >{{ category.postCount || 0 }} 帖子</span
                  >
                </div>
                <p
                  class="text-secondary text-sm mt-1"
                  v-if="category.description"
                >
                  {{ category.description }}
                </p>
              </div>
              <div class="category-actions flex gap-2">
                <button
                  class="btn btn-sm btn-outline"
                  @click="startEditCategory(category)"
                >
                  编辑
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  @click="confirmDeleteCategory(category)"
                  :disabled="!!(category.postCount && category.postCount > 0)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="editingCategory" class="card mt-4">
        <div class="card-header">
          <h3>编辑板块</h3>
        </div>
        <div class="card-body">
          <form @submit.prevent="handleUpdateCategory" class="form">
            <div class="form-row flex gap-4">
              <div class="form-group flex-1">
                <label class="form-label">名称</label>
                <input
                  v-model="editingCategory.name"
                  type="text"
                  class="form-input"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">标识 (slug)</label>
                <input
                  v-model="editingCategory.slug"
                  type="text"
                  class="form-input"
                  required
                />
              </div>
              <div class="form-group flex-1">
                <label class="form-label">排序</label>
                <input
                  v-model.number="editingCategory.order"
                  type="number"
                  class="form-input"
                />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">描述</label>
              <input
                v-model="editingCategory.description"
                type="text"
                class="form-input"
              />
            </div>
            <div class="form-actions flex gap-2">
              <button
                type="button"
                class="btn btn-outline"
                @click="cancelEditCategory"
              >
                取消
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="submittingCategory"
              >
                {{ submittingCategory ? "保存中..." : "保存" }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div v-else-if="activeTab === 'posts'">
      <div class="card">
        <div class="card-header">
          <div class="flex items-center justify-between">
            <h3>帖子管理</h3>
            <div class="filters flex gap-2">
              <select
                v-model="postFilterCategory"
                class="form-select"
                style="width: auto"
              >
                <option value="">所有板块</option>
                <option
                  v-for="cat in categories"
                  :key="cat._id"
                  :value="cat._id"
                >
                  {{ cat.name }}
                </option>
              </select>
              <select
                v-model="postFilterSort"
                class="form-select"
                style="width: auto"
              >
                <option value="latest">最新</option>
                <option value="hot">最热</option>
              </select>
              <button
                class="btn btn-sm btn-outline"
                @click="fetchAdminPosts(true)"
              >
                刷新
              </button>
            </div>
          </div>
        </div>
        <div class="card-body">
          <div v-if="loadingPosts && adminPosts.length === 0" class="loading">
            <div class="spinner"></div>
          </div>

          <div
            v-else-if="adminPosts.length === 0"
            class="text-center text-secondary py-4"
          >
            暂无帖子
          </div>

          <div v-else class="posts-table">
            <div
              v-for="post in adminPosts"
              :key="post._id"
              class="post-row flex items-center justify-between p-3 border-b"
            >
              <div class="post-info flex-1">
                <div class="flex items-center gap-2">
                  <span v-if="post.isPinned" class="badge badge-warning"
                    >置顶</span
                  >
                  <router-link :to="`/posts/${post._id}`" class="font-medium">
                    {{ post.title }}
                  </router-link>
                </div>
                <div class="text-sm text-secondary mt-1 flex gap-4">
                  <span>作者: {{ post.author?.username }}</span>
                  <span>板块: {{ post.category?.name }}</span>
                  <span>回复: {{ post.replyCount }}</span>
                  <span>点赞: {{ post.likeCount }}</span>
                  <span>{{ formatDate(post.createdAt) }}</span>
                </div>
              </div>
              <div class="post-actions flex gap-2">
                <button
                  class="btn btn-sm btn-outline"
                  @click="togglePostPin(post)"
                >
                  {{ post.isPinned ? "取消置顶" : "置顶" }}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  @click="confirmDeletePost(post)"
                >
                  删除
                </button>
              </div>
            </div>
          </div>

          <div v-if="loadingPosts" class="loading mt-4">
            <div class="spinner"></div>
          </div>

          <div
            v-if="hasMorePosts && !loadingPosts"
            ref="loadMoreRef"
            class="load-more"
          ></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { categoryAPI, postAPI } from "@/api";
import { formatDate } from "@/utils/date";
import type { Category, Post } from "@/types";

const activeTab = ref<"categories" | "posts">("categories");

const error = ref("");

const categories = ref<Category[]>([]);
const loadingCategories = ref(false);

const newCategory = ref({
  name: "",
  slug: "",
  description: "",
  order: 0,
});

const editingCategory = ref<Category | null>(null);
const submittingCategory = ref(false);

const adminPosts = ref<Post[]>([]);
const loadingPosts = ref(false);
const hasMorePosts = ref(true);
const nextCursorPosts = ref<string | null>(null);
const postFilterCategory = ref("");
const postFilterSort = ref<"latest" | "hot">("latest");

const loadMoreRef = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;

const fetchCategories = async () => {
  loadingCategories.value = true;
  error.value = "";

  try {
    const response = await categoryAPI.getAll();
    categories.value = response.data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "加载板块失败";
  } finally {
    loadingCategories.value = false;
  }
};

const fetchAdminPosts = async (reset = false) => {
  if (loadingPosts.value || (!hasMorePosts.value && !reset)) return;

  loadingPosts.value = true;

  try {
    const response = await postAPI.getAll({
      categoryId: postFilterCategory.value || undefined,
      sort: postFilterSort.value,
      limit: 20,
      before: reset ? undefined : nextCursorPosts.value || undefined,
    });

    if (reset) {
      adminPosts.value = response.data.data;
    } else {
      adminPosts.value = [...adminPosts.value, ...response.data.data];
    }
    hasMorePosts.value = response.data.hasMore;
    nextCursorPosts.value = response.data.nextCursor;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "加载帖子失败";
  } finally {
    loadingPosts.value = false;
  }
};

const handleAddCategory = async () => {
  if (!newCategory.value.name.trim() || !newCategory.value.slug.trim()) {
    error.value = "请填写板块名称和标识";
    return;
  }

  submittingCategory.value = true;
  error.value = "";

  try {
    await categoryAPI.create({
      name: newCategory.value.name.trim(),
      slug: newCategory.value.slug.trim().toLowerCase(),
      description: newCategory.value.description,
      order: newCategory.value.order,
    });

    newCategory.value = { name: "", slug: "", description: "", order: 0 };
    fetchCategories();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "添加失败，请重试";
  } finally {
    submittingCategory.value = false;
  }
};

const startEditCategory = (category: Category) => {
  editingCategory.value = { ...category };
};

const cancelEditCategory = () => {
  editingCategory.value = null;
};

const handleUpdateCategory = async () => {
  if (!editingCategory.value) return;

  submittingCategory.value = true;
  error.value = "";

  try {
    await categoryAPI.update(editingCategory.value._id, {
      name: editingCategory.value.name.trim(),
      slug: editingCategory.value.slug.trim().toLowerCase(),
      description: editingCategory.value.description,
      order: editingCategory.value.order,
    });

    editingCategory.value = null;
    fetchCategories();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "更新失败，请重试";
  } finally {
    submittingCategory.value = false;
  }
};

const confirmDeleteCategory = (category: Category) => {
  if (category.postCount && category.postCount > 0) {
    error.value = "该板块下有帖子，无法删除";
    return;
  }

  if (window.confirm(`确定要删除板块"${category.name}"吗？`)) {
    deleteCategory(category._id);
  }
};

const deleteCategory = async (categoryId: string) => {
  error.value = "";

  try {
    await categoryAPI.delete(categoryId);
    fetchCategories();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "删除失败，请重试";
  }
};

const togglePostPin = async (post: Post) => {
  try {
    await postAPI.pin(post._id, !post.isPinned);
    post.isPinned = !post.isPinned;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "操作失败，请重试";
  }
};

const confirmDeletePost = (post: Post) => {
  if (window.confirm(`确定要删除帖子"${post.title}"吗？`)) {
    deletePost(post._id);
  }
};

const deletePost = async (postId: string) => {
  error.value = "";

  try {
    await postAPI.delete(postId);
    adminPosts.value = adminPosts.value.filter((p) => p._id !== postId);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "删除失败，请重试";
  }
};

watch([postFilterCategory, postFilterSort], () => {
  hasMorePosts.value = true;
  nextCursorPosts.value = null;
  adminPosts.value = [];
  fetchAdminPosts(true);
});

onMounted(async () => {
  await fetchCategories();

  if (loadMoreRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMorePosts.value &&
          !loadingPosts.value
        ) {
          fetchAdminPosts(false);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.value);
  }
});

onUnmounted(() => {
  if (observer) observer.disconnect();
});
</script>

<style scoped>
.page-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.tabs {
  margin-bottom: 1rem;
}

.tab-btn {
  padding: 0.5rem 1rem;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary);
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab-btn:hover {
  color: var(--primary-color);
}

.tab-btn.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
}

.form-row {
  flex-wrap: wrap;
}

.flex-1 {
  flex: 1;
  min-width: 150px;
}

.category-row,
.post-row {
  border-bottom: 1px solid var(--border-color);
}

.category-row:last-child,
.post-row:last-child {
  border-bottom: none;
}

.font-medium {
  font-weight: 500;
}

.font-medium:hover {
  text-decoration: underline;
}

.load-more {
  height: 20px;
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.mb-4 {
  margin-bottom: 1rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-4 {
  margin-top: 1rem;
}

.gap-2 {
  gap: 0.5rem;
}

.gap-4 {
  gap: 1rem;
}

.text-sm {
  font-size: 0.875rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.border-b {
  border-bottom: 1px solid var(--border-color);
}

.p-3 {
  padding: 0.75rem;
}
</style>
