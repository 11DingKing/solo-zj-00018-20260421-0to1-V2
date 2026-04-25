import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { User } from '@/types';
import { authAPI } from '@/api';

export const useUserStore = defineStore('user', () => {
  const token = ref<string | null>(localStorage.getItem('token'));
  const user = ref<User | null>(null);
  
  const isLoggedIn = computed(() => !!token.value);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);
  
  async function loadStoredUser() {
    const storedUser = localStorage.getItem('user');
    if (storedUser && token.value) {
      try {
        user.value = JSON.parse(storedUser);
        const response = await authAPI.getMe();
        user.value = response.data;
        localStorage.setItem('user', JSON.stringify(user.value));
      } catch {
        logout();
      }
    }
  }
  
  async function login(username: string, password: string) {
    const response = await authAPI.login(username, password);
    token.value = response.data.token;
    user.value = response.data.user;
    localStorage.setItem('token', token.value);
    localStorage.setItem('user', JSON.stringify(user.value));
    return response.data;
  }
  
  async function register(username: string, password: string) {
    const response = await authAPI.register(username, password);
    token.value = response.data.token;
    user.value = response.data.user;
    localStorage.setItem('token', token.value);
    localStorage.setItem('user', JSON.stringify(user.value));
    return response.data;
  }
  
  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
  
  return {
    token,
    user,
    isLoggedIn,
    isAdmin,
    loadStoredUser,
    login,
    register,
    logout,
  };
});
