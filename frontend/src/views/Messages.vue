<template>
  <div class="messages-page container">
    <div class="messages-layout">
      <div
        class="conversation-list-panel"
        :class="{ 'mobile-hidden': isMobile && selectedUserId }"
      >
        <div class="panel-header">
          <h2 class="panel-title">消息中心</h2>
        </div>
        
        <div class="conversation-list">
          <div v-if="loadingConversations" class="loading">
            <div class="spinner"></div>
          </div>
          
          <div
            v-else-if="chatStore.conversations.length === 0"
            class="empty-state"
          >
            <p class="text-secondary">暂无消息</p>
          </div>
          
          <div
            v-else
            v-for="conversation in chatStore.conversations"
            :key="conversation.otherUser?._id"
            class="conversation-item"
            :class="{
              active: selectedUserId === conversation.otherUser?._id,
              'has-unread': conversation.unreadCount > 0,
            }"
            @click="handleSelectConversation(conversation.otherUser?._id)"
          >
            <div class="conversation-avatar">
              <span class="avatar-text">
                {{ conversation.otherUser?.username?.charAt(0)?.toUpperCase() || '?' }}
              </span>
            </div>
            
            <div class="conversation-info">
              <div class="conversation-header">
                <span class="conversation-username" :class="{ 'unread-bold': conversation.unreadCount > 0 }">
                  {{ conversation.otherUser?.username || '未知用户' }}
                </span>
                <span class="conversation-time text-secondary text-xs">
                  {{ formatMessageTime(conversation.lastMessage.createdAt) }}
                </span>
              </div>
              <div class="conversation-preview">
                <span class="preview-text text-secondary">
                  {{ conversation.lastMessage.isSentByMe ? '你: ' : '' }}
                  {{ truncateContent(conversation.lastMessage.content) }}
                </span>
                <span
                  v-if="conversation.unreadCount > 0"
                  class="unread-badge"
                >
                  {{ conversation.unreadCount > 99 ? '99+' : conversation.unreadCount }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div
        class="message-detail-panel"
        :class="{ 'mobile-visible': isMobile && selectedUserId }"
      >
        <div v-if="!selectedUserId" class="no-conversation-selected">
          <div class="empty-state-large">
            <span class="empty-icon">💬</span>
            <p class="text-secondary mt-4">选择一个对话开始聊天</p>
          </div>
        </div>
        
        <template v-else>
          <div class="panel-header message-header">
            <button
              v-if="isMobile"
              class="back-btn"
              @click="handleBackToList"
            >
              ← 返回
            </button>
            <div class="message-header-info">
              <span class="header-avatar">
                {{ currentOtherUsername?.charAt(0)?.toUpperCase() || '?' }}
              </span>
              <span class="header-username">{{ currentOtherUsername || '未知用户' }}</span>
            </div>
          </div>
          
          <div
            class="message-list"
            ref="messageListRef"
            @scroll="handleScroll"
          >
            <div v-if="loadingMessages" class="loading">
              <div class="spinner"></div>
            </div>
            
            <div
              v-if="hasMoreMessages"
              class="load-more-messages"
              @click="loadMoreMessages"
            >
              <button class="btn btn-outline btn-sm">加载更多消息</button>
            </div>
            
            <div
              v-for="message in chatStore.currentConversationMessages"
              :key="message._id"
              class="message-item"
              :class="{ 'message-own': isOwnMessage(message) }"
            >
              <div class="message-bubble-wrapper">
                <div
                  class="message-bubble"
                  :class="{ 'bubble-own': isOwnMessage(message) }"
                >
                  <p class="message-content">{{ message.content }}</p>
                </div>
                <span class="message-time text-xs text-secondary">
                  {{ formatMessageTime(message.createdAt) }}
                  <span v-if="isOwnMessage(message) && message.isRead"> · 已读</span>
                </span>
              </div>
            </div>
            
            <div ref="bottomRef"></div>
          </div>
          
          <div class="message-input-area">
            <div class="input-wrapper">
              <textarea
                v-model="messageInput"
                class="message-textarea"
                placeholder="输入消息... (最多500字)"
                @keydown.enter.exact="handleSendMessage"
                :disabled="sendingMessage"
                maxlength="500"
                rows="1"
              ></textarea>
              <div class="char-count">
                <span :class="{ 'char-limit': messageInput.length > 500 }">
                  {{ messageInput.length }}/500
                </span>
              </div>
            </div>
            <button
              class="btn btn-primary send-btn"
              @click="handleSendMessage"
              :disabled="!canSendMessage || sendingMessage"
            >
              {{ sendingMessage ? '发送中...' : '发送' }}
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChatStore } from '@/stores/chat';
import { useUserStore } from '@/stores/user';
import { formatDate } from '@/utils/date';

const route = useRoute();
const router = useRouter();
const chatStore = useChatStore();
const userStore = useUserStore();

const isMobile = ref(window.innerWidth < 768);
const messageInput = ref('');
const sendingMessage = ref(false);
const loadingConversations = ref(false);
const loadingMessages = ref(false);
const hasMoreMessages = ref(true);
const messageListRef = ref<HTMLElement | null>(null);
const bottomRef = ref<HTMLElement | null>(null);

const selectedUserId = computed(() => {
  return route.query.userId as string | null;
});

const currentOtherUsername = computed(() => {
  const conv = chatStore.conversations.find(
    (c) => c.otherUser && c.otherUser._id === selectedUserId.value
  );
  return conv?.otherUser?.username || null;
});

const canSendMessage = computed(() => {
  const trimmed = messageInput.value.trim();
  return trimmed.length > 0 && trimmed.length <= 500 && selectedUserId.value;
});

const isOwnMessage = (message: { senderId: string }) => {
  return message.senderId === userStore.user?.id;
};

const truncateContent = (content: string) => {
  if (content.length > 50) {
    return content.substring(0, 50) + '...';
  }
  return content;
};

const formatMessageTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffDays = Math.floor((today.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays < 7) {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return weekdays[date.getDay()] + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  } else {
    return formatDate(dateStr);
  }
};

const scrollToBottom = (smooth = false) => {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  });
};

const handleSelectConversation = async (userId?: string) => {
  if (!userId) return;
  
  if (isMobile.value) {
    router.push({ path: '/messages', query: { userId } });
  } else {
    router.replace({ path: '/messages', query: { userId } });
  }
};

const handleBackToList = () => {
  router.push({ path: '/messages', query: {} });
  chatStore.clearCurrentConversation();
};

const handleSendMessage = async () => {
  if (!canSendMessage.value || !selectedUserId.value) return;
  
  const content = messageInput.value.trim();
  if (content.length === 0 || content.length > 500) return;
  
  sendingMessage.value = true;
  
  try {
    const result = await chatStore.sendMessage(selectedUserId.value, content);
    if (result) {
      messageInput.value = '';
      scrollToBottom(true);
    }
  } catch (error) {
    console.error('Failed to send message:', error);
  } finally {
    sendingMessage.value = false;
  }
};

const loadMoreMessages = async () => {
  if (!selectedUserId.value || !hasMoreMessages.value) return;
  
  loadingMessages.value = true;
  try {
    const hasMore = await chatStore.fetchConversation(selectedUserId.value, false);
    hasMoreMessages.value = hasMore;
  } catch (error) {
    console.error('Failed to load more messages:', error);
  } finally {
    loadingMessages.value = false;
  }
};

const handleScroll = () => {
  if (!messageListRef.value) return;
  
  const { scrollTop } = messageListRef.value;
  if (scrollTop < 50 && hasMoreMessages.value && !loadingMessages.value) {
    loadMoreMessages();
  }
};

const handleResize = () => {
  isMobile.value = window.innerWidth < 768;
};

watch(selectedUserId, async (newUserId) => {
  if (newUserId) {
    hasMoreMessages.value = true;
    await chatStore.selectConversation(newUserId);
    scrollToBottom(false);
  }
});

watch(
  () => chatStore.currentConversationMessages.length,
  () => {
    scrollToBottom(true);
  }
);

onMounted(async () => {
  window.addEventListener('resize', handleResize);
  
  loadingConversations.value = true;
  try {
    await chatStore.fetchConversations();
    
    if (selectedUserId.value) {
      await chatStore.selectConversation(selectedUserId.value);
      scrollToBottom(false);
    }
  } finally {
    loadingConversations.value = false;
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.messages-page {
  height: calc(100vh - 140px);
  min-height: 500px;
}

.messages-layout {
  display: flex;
  height: 100%;
  background-color: white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.conversation-list-panel {
  width: 320px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
}

.message-detail-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.panel-header {
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border-color);
  background-color: var(--bg-color);
}

.panel-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.message-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.back-btn {
  background: none;
  border: none;
  color: var(--primary-color);
  cursor: pointer;
  padding: 0.25rem;
  font-size: 1rem;
}

.back-btn:hover {
  text-decoration: underline;
}

.message-header-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.header-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.875rem;
}

.header-username {
  font-weight: 600;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  padding: 0.875rem 1.25rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.conversation-item:hover {
  background-color: var(--bg-color);
}

.conversation-item.active {
  background-color: var(--bg-color);
}

.conversation-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background-color: var(--primary-color);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 1.125rem;
  flex-shrink: 0;
}

.avatar-text {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.conversation-info {
  flex: 1;
  margin-left: 0.875rem;
  min-width: 0;
}

.conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.25rem;
}

.conversation-username {
  font-weight: 500;
  font-size: 0.9375rem;
}

.conversation-username.unread-bold {
  font-weight: 700;
}

.conversation-time {
  white-space: nowrap;
  margin-left: 0.5rem;
}

.conversation-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-text {
  font-size: 0.8125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.unread-badge {
  background-color: var(--danger-color, #ef4444);
  color: white;
  font-size: 0.6875rem;
  font-weight: 600;
  padding: 0.125rem 0.4375rem;
  border-radius: 9999px;
  min-width: 1.25rem;
  text-align: center;
  flex-shrink: 0;
  margin-left: 0.5rem;
}

.no-conversation-selected {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state-large {
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.5;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
}

.message-item {
  display: flex;
  margin-bottom: 1rem;
}

.message-item.message-own {
  justify-content: flex-end;
}

.message-bubble-wrapper {
  max-width: 70%;
}

.message-bubble {
  padding: 0.75rem 1rem;
  border-radius: 1.125rem;
  background-color: var(--bg-color);
}

.message-bubble.bubble-own {
  background-color: var(--primary-color);
  color: white;
}

.message-content {
  margin: 0;
  word-break: break-word;
  white-space: pre-wrap;
  line-height: 1.5;
}

.message-time {
  margin-top: 0.25rem;
  padding: 0 0.25rem;
}

.load-more-messages {
  text-align: center;
  padding: 0.5rem;
}

.message-input-area {
  padding: 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  gap: 0.75rem;
  align-items: flex-end;
}

.input-wrapper {
  flex: 1;
  position: relative;
}

.message-textarea {
  width: 100%;
  padding: 0.75rem 1rem 2rem 1rem;
  border: 1px solid var(--border-color);
  border-radius: 1.25rem;
  resize: none;
  font-size: 0.9375rem;
  line-height: 1.4;
  max-height: 120px;
  outline: none;
  transition: border-color 0.2s;
}

.message-textarea:focus {
  border-color: var(--primary-color);
}

.message-textarea:disabled {
  background-color: var(--bg-color);
  cursor: not-allowed;
}

.char-count {
  position: absolute;
  bottom: 0.5rem;
  right: 1rem;
  font-size: 0.6875rem;
  color: var(--text-secondary);
}

.char-count .char-limit {
  color: var(--danger-color, #ef4444);
}

.send-btn {
  flex-shrink: 0;
  border-radius: 1.25rem;
  padding: 0.75rem 1.5rem;
}

.send-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.empty-state {
  text-align: center;
  padding: 2rem;
}

.text-xs {
  font-size: 0.75rem;
}

.text-secondary {
  color: var(--text-secondary);
}

.text-primary {
  color: var(--primary-color);
}

.mt-4 {
  margin-top: 1rem;
}

@media (max-width: 768px) {
  .messages-page {
    height: calc(100vh - 100px);
    min-height: 400px;
  }
  
  .messages-layout {
    position: relative;
  }
  
  .conversation-list-panel {
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border-right: none;
  }
  
  .conversation-list-panel.mobile-hidden {
    display: none;
  }
  
  .message-detail-panel {
    width: 100%;
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: none;
  }
  
  .message-detail-panel.mobile-visible {
    display: flex;
  }
  
  .message-bubble-wrapper {
    max-width: 85%;
  }
}
</style>
