<template>
  <div class="profile-page container">
    <div v-if="loadingProfile" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <div v-else class="page-layout">
      <aside class="sidebar">
        <div class="card">
          <div class="card-body text-center">
            <div class="avatar-placeholder text-4xl mb-4">
              {{ profileUsername?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <h2 class="text-xl font-bold">{{ profileUsername }}</h2>
            <p class="text-secondary text-sm mt-2">
              注册时间: {{ formatDateShort(profileCreatedAt) }}
            </p>
            <p class="text-secondary text-sm mt-1" v-if="profileIsAdmin">
              <span class="badge badge-warning">管理员</span>
            </p>

            <div v-if="!isOwnProfile && userStore.isLoggedIn" class="mt-4">
              <button
                class="btn btn-primary w-full"
                @click="handleSendMessage"
              >
                💬 发私信
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main class="main-section">
        <div class="card">
          <div class="card-header">
            <div class="tabs flex gap-4">
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'posts' }"
                @click="activeTab = 'posts'"
              >
                {{ isOwnProfile ? '我的帖子' : 'Ta的帖子' }}
              </button>
              <button
                v-if="isOwnProfile"
                class="tab-btn"
                :class="{ active: activeTab === 'replies' }"
                @click="activeTab = 'replies'"
              >
                我的回复
              </button>
            </div>
          </div>

          <div class="card-body">
            <div v-if="activeTab === 'posts'">
              <div v-if="loadingPosts && posts.length === 0" class="loading">
                <div class="spinner"></div>
              </div>

              <div
                v-else-if="posts.length === 0"
                class="text-center text-secondary py-4"
              >
                暂无帖子
              </div>

              <div v-else>
                <div
                  v-for="post in posts"
                  :key="post._id"
                  class="post-item card mb-2"
                >
                  <div class="card-body">
                    <router-link
                      :to="`/posts/${post._id}`"
                      class="post-title block"
                    >
                      {{ post.title }}
                    </router-link>
                    <div
                      class="post-meta flex items-center gap-4 text-sm text-secondary mt-2"
                    >
                      <span class="badge badge-primary">{{
                        post.category?.name
                      }}</span>
                      <span>回复: {{ post.replyCount }}</span>
                      <span>点赞: {{ post.likeCount }}</span>
                      <span>浏览: {{ post.viewCount }}</span>
                      <span>{{ formatDate(post.createdAt) }}</span>
                    </div>
                  </div>
                </div>

                <div v-if="loadingPosts" class="loading">
                  <div class="spinner"></div>
                </div>

                <div
                  v-if="hasMorePosts && !loadingPosts"
                  ref="loadMorePostsRef"
                  class="load-more"
                ></div>
              </div>
            </div>

            <div v-else-if="activeTab === 'replies'">
              <div
                v-if="loadingReplies && replies.length === 0"
                class="loading"
              >
                <div class="spinner"></div>
              </div>

              <div
                v-else-if="replies.length === 0"
                class="text-center text-secondary py-4"
              >
                暂无回复
              </div>

              <div v-else>
                <div
                  v-for="reply in replies"
                  :key="reply._id"
                  class="reply-item card mb-2"
                >
                  <div class="card-body">
                    <div class="flex items-center justify-between mb-2">
                      <router-link
                        :to="`/posts/${reply.postId}#${reply._id}`"
                        class="text-primary"
                      >
                        查看原帖
                      </router-link>
                      <span class="text-xs text-secondary">{{
                        formatDate(reply.createdAt)
                      }}</span>
                    </div>
                    <p class="reply-content">{{ reply.content }}</p>
                  </div>
                </div>

                <div v-if="loadingReplies" class="loading">
                  <div class="spinner"></div>
                </div>

                <div
                  v-if="hasMoreReplies && !loadingReplies"
                  ref="loadMoreRepliesRef"
                  class="load-more"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { postAPI, replyAPI, userAPI } from "@/api";
import { formatDate, formatDateShort } from "@/utils/date";
import type { Post, Reply, User } from "@/types";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const activeTab = ref<"posts" | "replies">("posts");

const posts = ref<Post[]>([]);
const replies = ref<Reply[]>([]);

const loadingProfile = ref(false);
const loadingPosts = ref(false);
const loadingReplies = ref(false);

const hasMorePosts = ref(true);
const hasMoreReplies = ref(true);

const nextCursorPosts = ref<string | null>(null);
const nextCursorReplies = ref<string | null>(null);

const loadMorePostsRef = ref<HTMLElement | null>(null);
const loadMoreRepliesRef = ref<HTMLElement | null>(null);

const error = ref("");

const profileUser = ref<User | null>(null);

const isOwnProfile = computed(() => {
  const routeUserId = route.params.id as string | undefined;
  if (!routeUserId) return true;
  return userStore.user?.id === routeUserId;
});

const profileUsername = computed(() => {
  if (isOwnProfile.value) {
    return userStore.user?.username || "";
  }
  return profileUser.value?.username || "";
});

const profileCreatedAt = computed(() => {
  if (isOwnProfile.value) {
    return userStore.user?.createdAt || "";
  }
  return profileUser.value?.createdAt || "";
});

const profileIsAdmin = computed(() => {
  if (isOwnProfile.value) {
    return userStore.isAdmin;
  }
  return profileUser.value?.isAdmin || false;
});

const profileUserId = computed(() => {
  if (isOwnProfile.value) {
    return userStore.user?.id;
  }
  return route.params.id as string;
});

let postsObserver: IntersectionObserver | null = null;
let repliesObserver: IntersectionObserver | null = null;

const fetchProfile = async () => {
  if (isOwnProfile.value) return;

  const userId = route.params.id as string;
  if (!userId) return;

  loadingProfile.value = true;
  error.value = "";

  try {
    const response = await userAPI.getById(userId);
    profileUser.value = response.data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "用户不存在";
  } finally {
    loadingProfile.value = false;
  }
};

const fetchPosts = async (reset = false) => {
  if (loadingPosts.value || (!hasMorePosts.value && !reset)) return;

  loadingPosts.value = true;

  try {
    if (isOwnProfile.value) {
      const response = await postAPI.getMy({
        limit: 20,
        before: reset ? undefined : nextCursorPosts.value || undefined,
      });

      if (reset) {
        posts.value = response.data.data;
      } else {
        posts.value = [...posts.value, ...response.data.data];
      }
      hasMorePosts.value = response.data.hasMore;
      nextCursorPosts.value = response.data.nextCursor;
    } else {
    }
  } catch (e) {
    console.error("Failed to fetch posts:", e);
  } finally {
    loadingPosts.value = false;
  }
};

const fetchMyReplies = async (reset = false) => {
  if (loadingReplies.value || (!hasMoreReplies.value && !reset)) return;

  loadingReplies.value = true;

  try {
    const response = await replyAPI.getMy({
      limit: 20,
      before: reset ? undefined : nextCursorReplies.value || undefined,
    });

    if (reset) {
      replies.value = response.data.data;
    } else {
      replies.value = [...replies.value, ...response.data.data];
    }
    hasMoreReplies.value = response.data.hasMore;
    nextCursorReplies.value = response.data.nextCursor;
  } catch (error) {
    console.error("Failed to fetch my replies:", error);
  } finally {
    loadingReplies.value = false;
  }
};

const handleSendMessage = () => {
  if (!profileUserId.value) return;
  router.push({
    path: "/messages",
    query: { userId: profileUserId.value },
  });
};

watch(
  () => route.params.id,
  async () => {
    if (!isOwnProfile.value) {
      await fetchProfile();
    }
    posts.value = [];
    hasMorePosts.value = true;
    nextCursorPosts.value = null;
    if (isOwnProfile.value || profileUser.value) {
      fetchPosts(true);
    }
  }
);

watch(activeTab, (newTab) => {
  if (newTab === "posts" && posts.value.length === 0) {
    fetchPosts(true);
  } else if (newTab === "replies" && isOwnProfile.value && replies.value.length === 0) {
    fetchMyReplies(true);
  }
});

onMounted(async () => {
  if (!isOwnProfile.value) {
    await fetchProfile();
  }

  fetchPosts(true);

  if (loadMorePostsRef.value) {
    postsObserver = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMorePosts.value &&
          !loadingPosts.value
        ) {
          fetchPosts(false);
        }
      },
      { threshold: 0.1 }
    );
    postsObserver.observe(loadMorePostsRef.value);
  }

  if (loadMoreRepliesRef.value) {
    repliesObserver = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMoreReplies.value &&
          !loadingReplies.value
        ) {
          fetchMyReplies(false);
        }
      },
      { threshold: 0.1 }
    );
    repliesObserver.observe(loadMoreRepliesRef.value);
  }
});

onUnmounted(() => {
  if (postsObserver) postsObserver.disconnect();
  if (repliesObserver) repliesObserver.disconnect();
});
</script>

<style scoped>
.page-layout {
  display: flex;
  gap: 1.5rem;
}

.sidebar {
  width: 280px;
  flex-shrink: 0;
}

.main-section {
  flex: 1;
}

.avatar-placeholder {
  width: 80px;
  height: 80px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--primary-color);
  color: white;
  border-radius: 50%;
  font-weight: 600;
}

.tabs {
  margin-bottom: -1rem;
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

.post-title {
  font-weight: 600;
  color: var(--text-color);
}

.post-title:hover {
  color: var(--primary-color);
  text-decoration: none;
}

.reply-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--text-color);
}

.text-4xl {
  font-size: 2.25rem;
}

.text-xl {
  font-size: 1.25rem;
}

.text-primary {
  color: var(--primary-color);
}

.load-more {
  height: 20px;
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2rem;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1rem;
}

.w-full {
  width: 100%;
}

.alert-error {
  padding: 1rem;
  background-color: #fee2e2;
  color: #dc2626;
  border-radius: 0.375rem;
  text-align: center;
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
