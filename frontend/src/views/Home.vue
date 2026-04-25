<template>
  <div class="home-page container">
    <div class="page-layout">
      <aside class="sidebar">
        <div class="card">
          <div class="card-header">
            <h3>板块</h3>
          </div>
          <div class="card-body">
            <ul class="category-list">
              <li
                class="category-item cursor-pointer"
                :class="{ active: selectedCategory === null }"
                @click="selectCategory(null)"
              >
                全部板块
              </li>
              <li
                v-for="cat in categories"
                :key="cat._id"
                class="category-item cursor-pointer"
                :class="{ active: selectedCategory === cat._id }"
                @click="selectCategory(cat._id)"
              >
                <span>{{ cat.name }}</span>
                <span class="text-xs text-secondary"
                  >({{ cat.postCount || 0 }})</span
                >
              </li>
            </ul>
          </div>
        </div>
      </aside>

      <main class="main-section">
        <div class="card mb-4">
          <div class="card-body flex items-center justify-between">
            <div class="sort-tabs flex gap-2">
              <button
                class="btn btn-sm"
                :class="sortBy === 'latest' ? 'btn-primary' : 'btn-outline'"
                @click="changeSort('latest')"
              >
                最新
              </button>
              <button
                class="btn btn-sm"
                :class="sortBy === 'hot' ? 'btn-primary' : 'btn-outline'"
                @click="changeSort('hot')"
              >
                最热
              </button>
            </div>
            <router-link
              v-if="userStore.isLoggedIn"
              to="/new-post"
              class="btn btn-primary"
            >
              发帖
            </router-link>
          </div>
        </div>

        <div v-if="loading && posts.length === 0" class="loading">
          <div class="spinner"></div>
        </div>

        <div v-else-if="posts.length === 0" class="card">
          <div class="card-body text-center text-secondary">暂无帖子</div>
        </div>

        <div v-else>
          <div
            v-for="post in posts"
            :key="post._id"
            class="card post-card mb-2"
          >
            <div class="card-body">
              <div class="post-header flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <router-link :to="`/posts/${post._id}`" class="post-title">
                    <span v-if="post.isPinned" class="badge badge-warning mr-2"
                      >置顶</span
                    >
                    {{ post.title }}
                  </router-link>
                </div>
              </div>
              <div
                class="post-meta flex items-center gap-4 text-sm text-secondary"
              >
                <span>
                  <span class="badge badge-primary">{{
                    post.category?.name
                  }}</span>
                </span>
                <span>作者: {{ post.author?.username }}</span>
                <span>回复: {{ post.replyCount }}</span>
                <span>点赞: {{ post.likeCount }}</span>
                <span>浏览: {{ post.viewCount }}</span>
                <span>{{ formatDate(post.createdAt) }}</span>
              </div>
            </div>
          </div>

          <div v-if="loading" class="loading">
            <div class="spinner"></div>
          </div>

          <div
            v-if="hasMore && !loading"
            ref="loadMoreRef"
            class="load-more"
          ></div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useUserStore } from "@/stores/user";
import { categoryAPI, postAPI } from "@/api";
import { formatDate } from "@/utils/date";
import type { Category, Post } from "@/types";

const userStore = useUserStore();

const categories = ref<Category[]>([]);
const posts = ref<Post[]>([]);
const selectedCategory = ref<string | null>(null);
const sortBy = ref<"latest" | "hot">("latest");
const loading = ref(false);
const hasMore = ref(true);
const nextCursor = ref<string | null>(null);
const loadMoreRef = ref<HTMLElement | null>(null);

let observer: IntersectionObserver | null = null;

const fetchCategories = async () => {
  try {
    const response = await categoryAPI.getAll();
    categories.value = response.data;
  } catch (error) {
    console.error("Failed to fetch categories:", error);
  }
};

const fetchPosts = async (reset = false) => {
  if (loading.value || (!hasMore.value && !reset)) return;

  loading.value = true;

  try {
    const response = await postAPI.getAll({
      categoryId: selectedCategory.value || undefined,
      sort: sortBy.value,
      limit: 20,
      before: reset ? undefined : nextCursor.value || undefined,
    });

    if (reset) {
      posts.value = response.data.data;
    } else {
      posts.value = [...posts.value, ...response.data.data];
    }
    hasMore.value = response.data.hasMore;
    nextCursor.value = response.data.nextCursor;
  } catch (error) {
    console.error("Failed to fetch posts:", error);
  } finally {
    loading.value = false;
  }
};

const selectCategory = (categoryId: string | null) => {
  if (selectedCategory.value === categoryId) return;
  selectedCategory.value = categoryId;
  hasMore.value = true;
  nextCursor.value = null;
  posts.value = [];
  fetchPosts(true);
};

const changeSort = (sort: "latest" | "hot") => {
  if (sortBy.value === sort) return;
  sortBy.value = sort;
  hasMore.value = true;
  nextCursor.value = null;
  posts.value = [];
  fetchPosts(true);
};

onMounted(async () => {
  await fetchCategories();
  await fetchPosts(true);

  if (loadMoreRef.value) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore.value && !loading.value) {
          fetchPosts(false);
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(loadMoreRef.value);
  }
});

onUnmounted(() => {
  if (observer) {
    observer.disconnect();
  }
});
</script>

<style scoped>
.page-layout {
  display: flex;
  gap: 1.5rem;
}

.sidebar {
  width: 240px;
  flex-shrink: 0;
}

.main-section {
  flex: 1;
}

.category-list {
  list-style: none;
}

.category-item {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  margin-bottom: 0.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-item:hover {
  background-color: var(--bg-color);
}

.category-item.active {
  background-color: #dbeafe;
  color: #1d4ed8;
}

.post-card {
  transition: box-shadow 0.2s;
}

.post-card:hover {
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.post-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-color);
}

.post-title:hover {
  color: var(--primary-color);
  text-decoration: none;
}

.mr-2 {
  margin-right: 0.5rem;
}

.load-more {
  height: 20px;
}

@media (max-width: 768px) {
  .page-layout {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
  }
}
</style>
