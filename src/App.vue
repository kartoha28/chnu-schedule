<script setup>
import { ref, onMounted } from 'vue';
import Uploader from './components/Uploader.vue';
import ScheduleView from './components/ScheduleView.vue';
import { storage } from './utils/storage.js';

const hasSchedule = ref(false);
const showUploader = ref(false); // Керує тим, чи показувати вікно налаштувань

// Перевіряємо, чи є вже розклад у пам'яті при запуску
onMounted(() => {
  checkData();
});

const checkData = () => {
  const data = storage.getBaseSchedule();
  if (data) {
    hasSchedule.value = true;
    showUploader.value = false;
  }
};

// Функція, яка спрацьовує, коли Uploader закінчив свою роботу
const onScheduleSaved = () => {
  checkData(); // Оновлюємо статус, щоб приховати Uploader і показати ScheduleView
};
</script>

<template>
  <main class="app-container">
    <header class="app-header">
      <h1>Розклад ЧНУ 📅</h1>
      <!-- Кнопка налаштувань з'являється тільки якщо розклад вже є -->
      <button
          v-if="hasSchedule"
          @click="showUploader = !showUploader"
          class="settings-btn"
      >
        {{ showUploader ? 'Закрити налаштування' : '⚙️ Оновити розклад' }}
      </button>
    </header>

    <!-- Якщо натиснуто кнопку налаштувань АБО розкладу ще немає взагалі -->
    <Uploader v-if="!hasSchedule || showUploader" @scheduleSaved="onScheduleSaved" />

    <!-- Якщо розклад є і меню налаштувань закрите -->
    <ScheduleView v-if="hasSchedule && !showUploader" />

  </main>
</template>

<style scoped>
.app-container {
  max-width: 800px; /* Зробили трохи ширше для красивих карток */
  margin: 0 auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 15px;
}

h1 { margin: 0; color: #2c3e50; }

.settings-btn {
  background: #f8f9fa;
  border: 1px solid #ddd;
  padding: 8px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: 0.2s;
}

.settings-btn:hover { background: #e2e6ea; }
</style>