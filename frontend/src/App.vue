<template>
  <div id="app">
    <header class="navbar">
      <div class="container flex items-center justify-between">
        <router-link to="/" class="logo">社区论坛</router-link>
        <nav class="nav-links flex items-center gap-4">
          <router-link to="/" class="nav-link">首页</router-link>
          <template v-if="userStore.isLoggedIn">
            <router-link to="/new-post" class="nav-link">发帖</router-link>
            <router-link to="/profile" class="nav-link">个人中心</router-link>
            <router-link v-if="userStore.isAdmin" to="/admin" class="nav-link">管理</router-link>
            <span class="text-secondary text-sm">{{ userStore.user?.username }}</span>
            <button @click="handleLogout" class="btn btn-outline btn-sm">退出</button>
          </template>
          <template v-else>
            <router-link to="/login" class="nav-link">登录</router-link>
            <router-link to="/register" class="btn btn-primary btn-sm">注册</router-link>
          </template>
        </nav>
      </div>
    </header>
    <main class="main-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

const handleLogout = () => {
  userStore.logout();
  router.push('/');
};
</script>

<style scoped>
.navbar {
  background-color: white;
  border-bottom: 1px solid var(--border-color);
  padding: 0.75rem 0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.logo {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-color);
}

.logo:hover {
  text-decoration: none;
  color: var(--primary-color);
}

.nav-link {
  color: var(--text-color);
  font-size: 0.875rem;
}

.nav-link:hover {
  text-decoration: none;
  color: var(--primary-color);
}

.main-content {
  min-height: calc(100vh - 64px);
  padding: 1.5rem 0;
}
</style>
