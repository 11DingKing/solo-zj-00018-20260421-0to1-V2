import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Message, Conversation } from '@/types';
import { messageAPI } from '@/api';
import { useUserStore } from '@/stores/user';

interface WebSocketMessage {
  type: 'connected' | 'new_message' | 'conversation_read' | 'pong';
  data: Record<string, unknown>;
}

export const useChatStore = defineStore('chat', () => {
  const userStore = useUserStore();
  
  const conversations = ref<Conversation[]>([]);
  const currentConversationMessages = ref<Message[]>([]);
  const currentOtherUserId = ref<string | null>(null);
  const unreadCount = ref(0);
  const isWsConnected = ref(false);
  
  let ws: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let pingTimer: number | null = null;
  
  const totalUnreadCount = computed(() => {
    return unreadCount.value;
  });
  
  const currentConversation = computed(() => {
    if (!currentOtherUserId.value) return null;
    return conversations.value.find(
      (c) => c.otherUser && c.otherUser._id === currentOtherUserId.value
    ) || null;
  });
  
  const connectWebSocket = () => {
    if (!userStore.token) return;
    
    if (ws) {
      ws.close();
    }
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(userStore.token)}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      isWsConnected.value = true;
      
      startPing();
    };
    
    ws.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      isWsConnected.value = false;
      stopPing();
      
      scheduleReconnect();
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log('WebSocket message received:', message.type);
        handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };
  };
  
  const disconnectWebSocket = () => {
    stopPing();
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.close();
      ws = null;
    }
    isWsConnected.value = false;
  };
  
  const startPing = () => {
    stopPing();
    pingTimer = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  };
  
  const stopPing = () => {
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };
  
  const scheduleReconnect = () => {
    if (!userStore.token) return;
    
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    reconnectTimer = window.setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      connectWebSocket();
    }, 5000);
  };
  
  const handleWebSocketMessage = (message: WebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connected confirmed:', message.data);
        break;
        
      case 'new_message':
        handleNewMessage(message.data as unknown as Message);
        break;
        
      case 'conversation_read':
        handleConversationRead(message.data as { userId: string; readAt: string });
        break;
        
      case 'pong':
        break;
    }
  };
  
  const handleNewMessage = (message: Message) => {
    console.log('New message received:', message);
    
    const userStore = useUserStore();
    const isFromMe = message.senderId === userStore.user?.id;
    const otherUserId = isFromMe ? message.receiverId : message.senderId;
    
    if (currentOtherUserId.value === otherUserId) {
      const exists = currentConversationMessages.value.some((m) => m._id === message._id);
      if (!exists) {
        currentConversationMessages.value.push(message);
      }
    }
    
    updateConversationWithNewMessage(message, otherUserId, isFromMe);
    
    if (!isFromMe && currentOtherUserId.value !== otherUserId) {
      unreadCount.value++;
    }
  };
  
  const handleConversationRead = (data: { userId: string; readAt: string }) => {
    const { userId } = data;
    
    const conv = conversations.value.find(
      (c) => c.otherUser && c.otherUser._id === userId
    );
    if (conv) {
      conv.unreadCount = 0;
      conv.lastMessage.isRead = true;
    }
  };
  
  const updateConversationWithNewMessage = (
    message: Message,
    otherUserId: string,
    isSentByMe: boolean
  ) => {
    const existingIndex = conversations.value.findIndex(
      (c) => c.otherUser && c.otherUser._id === otherUserId
    );
    
    const newConversation: Conversation = {
      otherUser: isSentByMe ? (message.receiver ?? null) : (message.sender ?? null),
      lastMessage: {
        _id: message._id,
        content: message.content,
        senderId: message.senderId,
        receiverId: message.receiverId,
        isRead: message.isRead,
        createdAt: message.createdAt,
        isSentByMe,
      },
      unreadCount: isSentByMe ? 0 : 1,
    };
    
    if (existingIndex >= 0) {
      const oldConv = conversations.value[existingIndex];
      newConversation.unreadCount = isSentByMe ? 0 : oldConv.unreadCount + 1;
      
      if (currentOtherUserId.value === otherUserId && !isSentByMe) {
        newConversation.unreadCount = oldConv.unreadCount;
      }
      
      conversations.value.splice(existingIndex, 1);
      conversations.value.unshift(newConversation);
    } else {
      conversations.value.unshift(newConversation);
    }
  };
  
  const fetchConversations = async () => {
    try {
      const response = await messageAPI.getConversations();
      conversations.value = response.data.data;
      
      let total = 0;
      conversations.value.forEach((c) => {
        total += c.unreadCount;
      });
      unreadCount.value = total;
    } catch (error) {
      console.error('Failed to fetch conversations:', error);
    }
  };
  
  const fetchConversation = async (userId: string, reset = false) => {
    try {
      const before = reset
        ? undefined
        : currentConversationMessages.value.length > 0
        ? currentConversationMessages.value[0]._id
        : undefined;
      
      const response = await messageAPI.getConversation(userId, {
        limit: 50,
        before,
      });
      
      if (reset) {
        currentConversationMessages.value = response.data.data;
      } else {
        const existingIds = new Set(currentConversationMessages.value.map((m) => m._id));
        const newMessages = response.data.data.filter((m) => !existingIds.has(m._id));
        currentConversationMessages.value = [...newMessages, ...currentConversationMessages.value];
      }
      
      currentOtherUserId.value = userId;
      
      return response.data.hasMore;
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      return false;
    }
  };
  
  const markConversationAsRead = async (userId: string) => {
    try {
      await messageAPI.markAsRead(userId);
      
      const conv = conversations.value.find(
        (c) => c.otherUser && c.otherUser._id === userId
      );
      if (conv) {
        const unreadToSubtract = conv.unreadCount;
        conv.unreadCount = 0;
        unreadCount.value = Math.max(0, unreadCount.value - unreadToSubtract);
      }
      
      currentConversationMessages.value.forEach((m) => {
        if (m.senderId === userId && !m.isRead) {
          m.isRead = true;
        }
      });
    } catch (error) {
      console.error('Failed to mark conversation as read:', error);
    }
  };
  
  const sendMessage = async (receiverId: string, content: string): Promise<Message | null> => {
    try {
      const trimmedContent = content.trim();
      if (!trimmedContent || trimmedContent.length > 500) {
        return null;
      }
      
      const response = await messageAPI.send({
        receiverId,
        content: trimmedContent,
      });
      
      const message = response.data;
      
      const exists = currentConversationMessages.value.some((m) => m._id === message._id);
      if (!exists) {
        currentConversationMessages.value.push(message);
      }
      
      updateConversationWithNewMessage(message, receiverId, true);
      
      return message;
    } catch (error) {
      console.error('Failed to send message:', error);
      return null;
    }
  };
  
  const selectConversation = async (userId: string) => {
    currentOtherUserId.value = userId;
    await fetchConversation(userId, true);
    await markConversationAsRead(userId);
  };
  
  const clearCurrentConversation = () => {
    currentOtherUserId.value = null;
    currentConversationMessages.value = [];
  };
  
  const init = () => {
    if (userStore.isLoggedIn) {
      connectWebSocket();
      fetchConversations();
    }
  };
  
  const reset = () => {
    disconnectWebSocket();
    conversations.value = [];
    currentConversationMessages.value = [];
    currentOtherUserId.value = null;
    unreadCount.value = 0;
    isWsConnected.value = false;
  };
  
  return {
    conversations,
    currentConversationMessages,
    currentOtherUserId,
    unreadCount,
    isWsConnected,
    totalUnreadCount,
    currentConversation,
    connectWebSocket,
    disconnectWebSocket,
    fetchConversations,
    fetchConversation,
    markConversationAsRead,
    sendMessage,
    selectConversation,
    clearCurrentConversation,
    init,
    reset,
  };
});
