<template>
  <div class="new-post-page container">
    <div class="card">
      <div class="card-header">
        <h2>发表新帖</h2>
      </div>
      <div class="card-body">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        
        <form @submit.prevent="handleSubmit" class="form">
          <div class="form-group">
            <label class="form-label">标题</label>
            <input
              v-model="form.title"
              type="text"
              class="form-input"
              placeholder="请输入帖子标题"
              required
              maxlength="200"
            />
          </div>
          
          <div class="form-group">
            <label class="form-label">板块</label>
            <select v-model="form.categoryId" class="form-select" required>
              <option value="">请选择板块</option>
              <option v-for="cat in categories" :key="cat._id" :value="cat._id">
                {{ cat.name }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">内容 (支持 Markdown)</label>
            <div class="editor-layout">
              <div class="editor-section">
                <div class="editor-toolbar flex gap-2 mb-2">
                  <button type="button" class="btn btn-sm btn-outline" @click="insertFormat('**', '**')">粗体</button>
                  <button type="button" class="btn btn-sm btn-outline" @click="insertFormat('*', '*')">斜体</button>
                  <button type="button" class="btn btn-sm btn-outline" @click="insertFormat('`', '`')">代码</button>
                  <button type="button" class="btn btn-sm btn-outline" @click="insertFormat('~~', '~~')">删除线</button>
                  <button type="button" class="btn btn-sm btn-outline" @click="insertFormat('[', '](url)')">链接</button>
                </div>
                <textarea
                  ref="textareaRef"
                  v-model="form.content"
                  class="form-input form-textarea"
                  placeholder="请输入帖子内容，支持 Markdown 格式"
                  required
                ></textarea>
              </div>
              <div class="preview-section">
                <div class="preview-label mb-2 text-sm text-secondary">预览</div>
                <div class="markdown-content preview-content" v-html="renderedContent"></div>
              </div>
            </div>
          </div>
          
          <div class="form-actions flex gap-2 justify-end">
            <button type="button" class="btn btn-outline" @click="goBack">取消</button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading">发布中...</span>
              <span v-else>发布</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { categoryAPI, postAPI } from '@/api';
import { marked } from 'marked';
import type { Category } from '@/types';

const router = useRouter();

const categories = ref<Category[]>([]);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const loading = ref(false);
const error = ref('');

const form = ref({
  title: '',
  categoryId: '',
  content: '',
});

const renderedContent = computed(() => {
  try {
    return marked(form.value.content) as string;
  } catch {
    return form.value.content;
  }
});

const fetchCategories = async () => {
  try {
    const response = await categoryAPI.getAll();
    categories.value = response.data;
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || '加载板块失败';
  }
};

const insertFormat = (prefix: string, suffix: string) => {
  if (!textareaRef.value) return;
  
  const textarea = textareaRef.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selectedText = textarea.value.substring(start, end);
  
  const newText = textarea.value.substring(0, start) + prefix + selectedText + suffix + textarea.value.substring(end);
  form.value.content = newText;
  
  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(start + prefix.length, end + prefix.length);
  }, 0);
};

const handleSubmit = async () => {
  if (!form.value.title.trim()) {
    error.value = '请输入标题';
    return;
  }
  
  if (!form.value.content.trim()) {
    error.value = '请输入内容';
    return;
  }
  
  if (!form.value.categoryId) {
    error.value = '请选择板块';
    return;
  }
  
  loading.value = true;
  error.value = '';
  
  try {
    const response = await postAPI.create({
      title: form.value.title.trim(),
      content: form.value.content.trim(),
      categoryId: form.value.categoryId,
    });
    router.push(`/posts/${response.data._id}`);
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } };
    error.value = err.response?.data?.error || '发布失败，请重试';
  } finally {
    loading.value = false;
  }
};

const goBack = () => {
  router.back();
};

onMounted(() => {
  fetchCategories();
});
</script>

<style scoped>
.editor-layout {
  display: flex;
  gap: 1.5rem;
}

.editor-section {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-section {
  flex: 1;
}

.preview-label {
  font-weight: 500;
}

.preview-content {
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  padding: 0.75rem;
  min-height: 300px;
  max-height: 500px;
  overflow-y: auto;
  background-color: #fafafa;
}

.form-textarea {
  min-height: 300px;
  max-height: 500px;
  font-family: 'Fira Code', 'Consolas', monospace;
  font-size: 0.875rem;
}

.form-actions {
  margin-top: 1.5rem;
}

@media (max-width: 900px) {
  .editor-layout {
    flex-direction: column;
  }
  
  .preview-section {
    display: none;
  }
}
</style>
