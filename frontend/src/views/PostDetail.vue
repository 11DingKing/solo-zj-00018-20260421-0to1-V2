<template>
  <div class="post-detail-page container">
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <div v-else-if="error" class="alert alert-error">{{ error }}</div>

    <div v-else class="page-layout">
      <main class="main-section">
        <div class="card mb-4">
          <div class="card-body">
            <div class="post-header">
              <h1 class="post-title">
                <span v-if="post.isPinned" class="badge badge-warning mr-2"
                  >置顶</span
                >
                {{ post.title }}
              </h1>
              <div
                class="post-meta flex items-center gap-4 text-sm text-secondary mt-2"
              >
                <span class="badge badge-primary">{{
                  post.category?.name
                }}</span>
                <span>作者: {{ post.author?.username }}</span>
                <span>回复: {{ post.replyCount }}</span>
                <span>点赞: {{ post.likeCount }}</span>
                <span>浏览: {{ post.viewCount }}</span>
                <span>{{ formatDate(post.createdAt) }}</span>
              </div>
            </div>

            <div class="post-actions flex gap-2 mt-4">
              <button
                class="btn btn-sm"
                :class="isPostLiked ? 'btn-primary' : 'btn-outline'"
                @click="likePost"
                :disabled="!userStore.isLoggedIn"
              >
                👍 点赞 ({{ post.likeCount }})
              </button>
              <template v-if="userStore.isAdmin">
                <button class="btn btn-sm btn-outline" @click="togglePin">
                  {{ post.isPinned ? "取消置顶" : "置顶" }}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  @click="confirmDeletePost"
                >
                  删除帖子
                </button>
              </template>
            </div>
          </div>
        </div>

        <div class="card mb-4">
          <div class="card-header">
            <h3>内容</h3>
          </div>
          <div class="card-body">
            <div class="markdown-content" v-html="renderedContent"></div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>回复 ({{ post.replyCount }})</h3>
          </div>

          <div class="card-body">
            <template v-if="userStore.isLoggedIn">
              <div class="reply-form mb-4">
                <textarea
                  v-model="newReplyContent"
                  class="form-input form-textarea mb-2"
                  placeholder="写下你的回复..."
                  rows="3"
                ></textarea>
                <div class="flex justify-end">
                  <button
                    class="btn btn-primary"
                    @click="submitReply"
                    :disabled="!newReplyContent.trim() || submittingReply"
                  >
                    {{ submittingReply ? "发送中..." : "回复" }}
                  </button>
                </div>
              </div>
            </template>

            <template v-else>
              <p class="text-secondary mb-4">
                请先<router-link to="/login">登录</router-link>后再回复
              </p>
            </template>

            <div v-if="loadingReplies" class="loading">
              <div class="spinner"></div>
            </div>

            <div
              v-else-if="replies.length === 0"
              class="text-center text-secondary py-4"
            >
              暂无回复，快来抢沙发吧！
            </div>

            <div v-else class="replies-list">
              <div
                v-for="(reply, index) in replies"
                :key="reply._id"
                class="reply-item"
              >
                <div class="reply-header flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="reply-floor text-secondary"
                      >#{{ index + 1 }}</span
                    >
                    <span class="font-medium">{{
                      reply.userId?.username
                    }}</span>
                    <span class="text-xs text-secondary">{{
                      formatDate(reply.createdAt)
                    }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      class="btn btn-sm"
                      :class="
                        likedReplies.has(reply._id)
                          ? 'btn-primary'
                          : 'btn-outline'
                      "
                      @click="likeReply(reply._id)"
                      :disabled="!userStore.isLoggedIn"
                    >
                      👍 {{ reply.likeCount }}
                    </button>
                    <button
                      v-if="userStore.isLoggedIn"
                      class="btn btn-sm btn-outline"
                      @click="
                        showChildReplyForm(
                          reply._id,
                          reply.userId?._id || '',
                          reply.userId?.username || '',
                        )
                      "
                    >
                      回复
                    </button>
                    <button
                      v-if="userStore.isAdmin"
                      class="btn btn-sm btn-danger"
                      @click="confirmDeleteReply(reply._id)"
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div class="reply-content mt-2">{{ reply.content }}</div>

                <div
                  v-if="reply.children && reply.children.length > 0"
                  class="child-replies mt-3"
                >
                  <div
                    v-for="child in reply.children"
                    :key="child._id"
                    class="child-reply-item"
                  >
                    <div class="reply-header flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <span class="font-medium">{{
                          child.userId?.username
                        }}</span>
                        <span v-if="child.replyToUserId" class="text-secondary">
                          回复 {{ child.replyToUserId?.username }}
                        </span>
                        <span class="text-xs text-secondary">{{
                          formatDate(child.createdAt)
                        }}</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <button
                          class="btn btn-sm"
                          :class="
                            likedReplies.has(child._id)
                              ? 'btn-primary'
                              : 'btn-outline'
                          "
                          @click="likeReply(child._id)"
                          :disabled="!userStore.isLoggedIn"
                        >
                          👍 {{ child.likeCount }}
                        </button>
                        <button
                          v-if="userStore.isLoggedIn"
                          class="btn btn-sm btn-outline"
                          @click="
                            showChildReplyForm(
                              reply._id,
                              child.userId?._id || '',
                              child.userId?.username || '',
                            )
                          "
                        >
                          回复
                        </button>
                        <button
                          v-if="userStore.isAdmin"
                          class="btn btn-sm btn-danger"
                          @click="confirmDeleteReply(child._id)"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                    <div class="reply-content mt-1">{{ child.content }}</div>
                  </div>
                </div>

                <div
                  v-if="replyingTo === reply._id"
                  class="child-reply-form mt-3"
                >
                  <p class="text-sm text-secondary mb-2">
                    回复
                    <span class="font-medium">{{ replyingToUsername }}</span>
                  </p>
                  <textarea
                    v-model="childReplyContent"
                    class="form-input form-textarea mb-2"
                    placeholder="写下你的回复..."
                    rows="2"
                  ></textarea>
                  <div class="flex justify-end gap-2">
                    <button
                      class="btn btn-sm btn-outline"
                      @click="cancelChildReply"
                    >
                      取消
                    </button>
                    <button
                      class="btn btn-sm btn-primary"
                      @click="submitChildReply(reply._id)"
                      :disabled="!childReplyContent.trim() || submittingReply"
                    >
                      {{ submittingReply ? "发送中..." : "回复" }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import { postAPI, replyAPI } from "@/api";
import { marked } from "marked";
import { formatDate } from "@/utils/date";
import type { Post, Reply } from "@/types";

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

const postId = computed(() => route.params.id as string);

const post = ref<Post>({
  _id: "",
  title: "",
  content: "",
  categoryId: "",
  userId: "",
  isPinned: false,
  replyCount: 0,
  likeCount: 0,
  viewCount: 0,
  createdAt: "",
  updatedAt: "",
});

const replies = ref<Reply[]>([]);
const loading = ref(true);
const loadingReplies = ref(false);
const error = ref("");
const newReplyContent = ref("");
const submittingReply = ref(false);
const replyingTo = ref<string | null>(null);
const replyingToUserId = ref("");
const replyingToUsername = ref("");
const childReplyContent = ref("");
const isPostLiked = ref(false);
const likedReplies = ref(new Set<string>());

const renderedContent = computed(() => {
  try {
    return marked(post.value.content) as string;
  } catch {
    return post.value.content;
  }
});

const fetchPost = async () => {
  loading.value = true;
  error.value = "";

  try {
    const response = await postAPI.getById(postId.value);
    post.value = response.data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "加载帖子失败";
  } finally {
    loading.value = false;
  }
};

const fetchReplies = async () => {
  loadingReplies.value = true;

  try {
    const response = await replyAPI.getByPost(postId.value);
    replies.value = response.data;
  } catch (error) {
    console.error("Failed to fetch replies:", error);
  } finally {
    loadingReplies.value = false;
  }
};

const likePost = async () => {
  if (!userStore.isLoggedIn) return;

  try {
    const response = await postAPI.like(postId.value);
    post.value.likeCount = response.data.likeCount;
    isPostLiked.value = response.data.liked;
  } catch (error) {
    console.error("Failed to like post:", error);
  }
};

const likeReply = async (replyId: string) => {
  if (!userStore.isLoggedIn) return;

  try {
    const response = await replyAPI.like(replyId);

    const updateLikeCount = (repliesArray: Reply[]) => {
      for (const reply of repliesArray) {
        if (reply._id === replyId) {
          reply.likeCount = response.data.likeCount;
          if (response.data.liked) {
            likedReplies.value.add(replyId);
          } else {
            likedReplies.value.delete(replyId);
          }
        }
        if (reply.children) {
          updateLikeCount(reply.children);
        }
      }
    };

    updateLikeCount(replies.value);
  } catch (error) {
    console.error("Failed to like reply:", error);
  }
};

const submitReply = async () => {
  if (!newReplyContent.value.trim() || !userStore.isLoggedIn) return;

  submittingReply.value = true;

  try {
    await replyAPI.create({
      postId: postId.value,
      content: newReplyContent.value.trim(),
    });
    newReplyContent.value = "";
    post.value.replyCount += 1;
    fetchReplies();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "回复失败，请重试";
  } finally {
    submittingReply.value = false;
  }
};

const showChildReplyForm = (
  parentId: string,
  replyToUserId: string,
  replyToUsername: string,
) => {
  replyingTo.value = parentId;
  replyingToUserId.value = replyToUserId;
  replyingToUsername.value = replyToUsername;
  childReplyContent.value = "";
};

const cancelChildReply = () => {
  replyingTo.value = null;
  childReplyContent.value = "";
};

const submitChildReply = async (parentId: string) => {
  if (!childReplyContent.value.trim() || !userStore.isLoggedIn) return;

  submittingReply.value = true;

  try {
    await replyAPI.create({
      postId: postId.value,
      content: childReplyContent.value.trim(),
      parentId,
      replyToUserId: replyingToUserId.value,
    });
    cancelChildReply();
    post.value.replyCount += 1;
    fetchReplies();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "回复失败，请重试";
  } finally {
    submittingReply.value = false;
  }
};

const togglePin = async () => {
  try {
    await postAPI.pin(postId.value, !post.value.isPinned);
    post.value.isPinned = !post.value.isPinned;
  } catch (error) {
    console.error("Failed to toggle pin:", error);
  }
};

const confirmDeletePost = () => {
  if (window.confirm("确定要删除这个帖子吗？")) {
    deletePost();
  }
};

const deletePost = async () => {
  try {
    await postAPI.delete(postId.value);
    router.push("/");
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "删除失败，请重试";
  }
};

const confirmDeleteReply = (replyId: string) => {
  if (window.confirm("确定要删除这条回复吗？")) {
    deleteReply(replyId);
  }
};

const deleteReply = async (replyId: string) => {
  try {
    await replyAPI.delete(replyId);
    post.value.replyCount -= 1;
    fetchReplies();
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || "删除失败，请重试";
  }
};

onMounted(async () => {
  await fetchPost();
  fetchReplies();
});
</script>

<style scoped>
.post-title {
  font-size: 1.5rem;
  font-weight: 600;
}

.reply-item {
  padding: 1rem;
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  margin-bottom: 0.75rem;
}

.reply-floor {
  font-size: 0.75rem;
}

.reply-content {
  white-space: pre-wrap;
  word-break: break-word;
}

.child-replies {
  padding-left: 1.5rem;
  border-left: 2px solid var(--border-color);
}

.child-reply-item {
  padding: 0.75rem;
  background-color: var(--bg-color);
  border-radius: 0.375rem;
  margin-bottom: 0.5rem;
}

.child-reply-form {
  padding: 0.75rem;
  background-color: #eff6ff;
  border-radius: 0.375rem;
}

.mr-2 {
  margin-right: 0.5rem;
}

.font-medium {
  font-weight: 500;
}

.py-4 {
  padding-top: 1rem;
  padding-bottom: 1rem;
}

.mt-1 {
  margin-top: 0.25rem;
}

.mt-2 {
  margin-top: 0.5rem;
}

.mt-3 {
  margin-top: 0.75rem;
}

.mt-4 {
  margin-top: 1rem;
}

.mb-2 {
  margin-bottom: 0.5rem;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
