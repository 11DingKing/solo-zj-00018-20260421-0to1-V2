<template>
  <div class="profile-page container">
    <div class="page-layout">
      <aside class="sidebar">
        <div class="card">
          <div class="card-body text-center">
            <div class="avatar-placeholder text-4xl mb-4">👤</div>
            <h2 class="text-xl font-bold">{{ userStore.user?.username }}</h2>
            <p class="text-secondary text-sm mt-2">
              注册时间: {{ formatDateShort(userStore.user?.createdAt) }}
            </p>
            <p class="text-secondary text-sm mt-1" v-if="userStore.isAdmin">
              <span class="badge badge-warning">管理员</span>
            </p>
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
                我的帖子
              </button>
              <button
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
import { ref, watch, onMounted, onUnmounted } from "vue";
import { useUserStore } from "@/stores/user";
import { postAPI, replyAPI } from "@/api";
import { formatDate, formatDateShort } from "@/utils/date";
import type { Post, Reply } from "@/types";

const userStore = useUserStore();

const activeTab = ref<"posts" | "replies">("posts");

const posts = ref<Post[]>([]);
const replies = ref<Reply[]>([]);

const loadingPosts = ref(false);
const loadingReplies = ref(false);

const hasMorePosts = ref(true);
const hasMoreReplies = ref(true);

const nextCursorPosts = ref<string | null>(null);
const nextCursorReplies = ref<string | null>(null);

const loadMorePostsRef = ref<HTMLElement | null>(null);
const loadMoreRepliesRef = ref<HTMLElement | null>(null);

let postsObserver: IntersectionObserver | null = null;
let repliesObserver: IntersectionObserver | null = null;

const fetchMyPosts = async (reset = false) => {
  if (loadingPosts.value || (!hasMorePosts.value && !reset)) return;

  loadingPosts.value = true;

  try {
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
  } catch (error) {
    console.error("Failed to fetch my posts:", error);
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

watch(activeTab, (newTab) => {
  if (newTab === "posts" && posts.value.length === 0) {
    fetchMyPosts(true);
  } else if (newTab === "replies" && replies.value.length === 0) {
    fetchMyReplies(true);
  }
});

onMounted(() => {
  fetchMyPosts(true);

  if (loadMorePostsRef.value) {
    postsObserver = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          hasMorePosts.value &&
          !loadingPosts.value
        ) {
          fetchMyPosts(false);
        }
      },
      { threshold: 0.1 },
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
      { threshold: 0.1 },
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
  background-color: var(--bg-color);
  border-radius: 50%;
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

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-4 {
  margin-top: 1rem;
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
