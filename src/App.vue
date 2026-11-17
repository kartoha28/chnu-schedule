<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Uploader from './components/Uploader.vue';
import ScheduleView from './components/ScheduleView.vue';
import { storage, getDefaultSemesterStartDate, calculateCurrentWeek } from './utils/storage.js';

const hasSchedule = ref(false);
const showUploader = ref(false);
const showMenu = ref(false);
const activeWeek = ref('1-й тиждень');
const settings = ref(null);

const bellTimes = [
  { pair: '01', time: '08:20 – 09:40' },
  { pair: '02', time: '09:50 – 11:10' },
  { pair: '03', time: '11:30 – 12:50' },
  { pair: '04', time: '13:00 – 14:20' },
  { pair: '05', time: '14:40 – 16:00' },
  { pair: '06', time: '16:10 – 17:30' },
  { pair: '07', time: '17:40 – 19:00' }
];

const semesterStartDateValue = computed(() => {
  return settings.value?.semesterStartDate || getDefaultSemesterStartDate();
});

const currentRealWeek = computed(() => {
  return calculateCurrentWeek(semesterStartDateValue.value);
});

const checkData = () => {
  const data = storage.getBaseSchedule();
  settings.value = storage.getSettings();

  if (data) {
    hasSchedule.value = true;
    showUploader.value = false;
    activeWeek.value = calculateCurrentWeek(settings.value?.semesterStartDate);
  } else {
    hasSchedule.value = false;
    showUploader.value = true;
  }
};

const onScheduleSaved = () => {
  checkData();
};

const openUploaderFromMenu = () => {
  showMenu.value = false;
  showUploader.value = true;
};

const handleSemesterDateChange = (event) => {
  const newDate = event.target.value || getDefaultSemesterStartDate();
  const updated = {
    ...(settings.value || {}),
    semesterStartDate: newDate
  };
  settings.value = updated;
  storage.saveSettings(updated);
  activeWeek.value = calculateCurrentWeek(newDate);
};

const handleKeydown = (event) => {
  if (event.key === 'Escape' && showMenu.value) {
    showMenu.value = false;
  }
};

watch(showMenu, (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

onMounted(() => {
  checkData();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  document.body.style.overflow = '';
});
</script>

<template>
  <div class="app-shell">
    <!-- Компактна липка шапка (Figma style) -->
    <header class="top-bar">
      <div class="top-bar-inner">
        <div class="brand">
          <div class="brand-logo" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="17" rx="3" />
              <path d="M3 10h18" />
              <path d="M8 2v4" />
              <path d="M16 2v4" />
              <rect x="7.5" y="13.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" stroke="none" />
            </svg>
          </div>
          <div class="brand-text">
            <span class="brand-title">Розклад</span>
            <span v-if="settings?.mainGroup" class="brand-group">{{ settings.mainGroup }}</span>
          </div>
        </div>

        <div class="top-bar-controls">
          <!-- Перемикач тижнів у шапці -->
          <div
            v-if="hasSchedule && !showUploader"
            class="week-switcher"
            role="tablist"
            aria-label="Перемикач навчального тижня"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="activeWeek === '1-й тиждень'"
              class="week-pill"
              :class="{ 'is-active': activeWeek === '1-й тиждень' }"
              @click="activeWeek = '1-й тиждень'"
            >
              1 тижд.
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeWeek === '2-й тиждень'"
              class="week-pill"
              :class="{ 'is-active': activeWeek === '2-й тиждень' }"
              @click="activeWeek = '2-й тиждень'"
            >
              2 тижд.
            </button>
          </div>

          <!-- Кнопка Бургер-меню -->
          <button
            type="button"
            class="burger-btn"
            aria-label="Відкрити меню налаштувань"
            :aria-expanded="showMenu"
            @click="showMenu = true"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Основний контент -->
    <main class="app-main">
      <Uploader
        v-if="!hasSchedule || showUploader"
        :can-cancel="hasSchedule"
        @schedule-saved="onScheduleSaved"
        @cancel="showUploader = false"
      />

      <ScheduleView
        v-else
        :active-week="activeWeek"
        :current-real-week="currentRealWeek"
      />
    </main>

    <!-- Виїзне Бургер-меню (Drawer + Backdrop) -->
    <Transition name="drawer-fade">
      <div
        v-if="showMenu"
        class="drawer-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування розкладу"
        @click.self="showMenu = false"
      >
        <aside class="drawer-panel">
          <div class="drawer-header">
            <h2 class="drawer-title">Налаштування</h2>
            <button
              type="button"
              class="drawer-close-btn"
              aria-label="Закрити меню"
              @click="showMenu = false"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div class="drawer-body">
            <!-- Секція 1: Профіль розкладу -->
            <div v-if="hasSchedule" class="drawer-section">
              <div class="drawer-section-label">Профіль розкладу</div>
              <div class="profile-card">
                <div class="profile-row">
                  <span class="profile-key">Група</span>
                  <span class="profile-val profile-val--group">{{ settings?.mainGroup || 'Не обрано' }}</span>
                </div>
                <div class="profile-row">
                  <span class="profile-key">За календарем зараз</span>
                  <span class="profile-val profile-val--week">{{ currentRealWeek }}</span>
                </div>
              </div>
            </div>

            <!-- Секція 2: Початок семестру -->
            <div class="drawer-section">
              <label class="drawer-section-label" for="drawer-semester-date">
                Початок семестру (1-й тиждень)
              </label>
              <input
                id="drawer-semester-date"
                type="date"
                class="drawer-date-input"
                :value="semesterStartDateValue"
                @change="handleSemesterDateChange"
              />
              <p class="drawer-hint">
                1-й тиждень рахується з понеділка тижня, до якого належить обрана дата.
              </p>
            </div>

            <!-- Секція 3: Дії з розкладом -->
            <div class="drawer-section">
              <div class="drawer-section-label">Дії</div>
              <button
                type="button"
                class="drawer-action-btn"
                @click="openUploaderFromMenu"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <span>{{ hasSchedule ? 'Оновити розклад (.xls / .xlsx)' : 'Імпортувати таблицю розкладу' }}</span>
              </button>
            </div>

            <!-- Секція 4: Розклад дзвінків ЧНУ -->
            <div class="drawer-section">
              <div class="drawer-section-label">Розклад дзвінків ЧНУ</div>
              <div class="bells-list">
                <div v-for="item in bellTimes" :key="item.pair" class="bell-row">
                  <span class="bell-badge">Пара {{ item.pair }}</span>
                  <span class="bell-time">{{ item.time }}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100dvh;
  background-color: var(--bg-app);
  color: var(--text-main);
  display: flex;
  flex-direction: column;
}

/* Top Bar */
.top-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--bg-header);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
}

.top-bar-inner {
  max-width: 600px;
  margin: 0 auto;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.brand-logo {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-lavender);
  color: var(--bg-app);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-main);
}

.brand-group {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-lavender);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.top-bar-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* Week Switcher Pill */
.week-switcher {
  display: flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 3px;
  gap: 2px;
}

.week-pill {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 6px 11px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.week-pill:hover:not(.is-active) {
  color: var(--text-main);
}

.week-pill.is-active {
  background: #252a3b;
  color: var(--text-main);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

/* Burger Button */
.burger-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  color: var(--text-main);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.burger-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
}

/* Main Container */
.app-main {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: 0 16px 32px;
  flex: 1;
}

/* Drawer Overlay */
.drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: rgba(5, 7, 11, 0.72);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  justify-content: flex-end;
}

.drawer-panel {
  width: min(340px, 86vw);
  height: 100dvh;
  background: var(--bg-surface);
  border-left: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.45);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  background: var(--bg-surface);
  z-index: 2;
}

.drawer-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
}

.drawer-close-btn {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.drawer-close-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-main);
}

.drawer-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 22px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-section-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.profile-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.profile-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.profile-key {
  font-size: 13px;
  color: var(--text-muted);
}

.profile-val {
  font-size: 13px;
  font-weight: 600;
}

.profile-val--group {
  color: var(--accent-lavender);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  padding: 2px 8px;
  border-radius: 6px;
}

.profile-val--week {
  color: var(--accent-teal);
  background: var(--accent-teal-bg);
  border: 1px solid var(--accent-teal-border);
  padding: 2px 8px;
  border-radius: 6px;
}

.drawer-date-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  color: var(--text-main);
  font-size: 14px;
  color-scheme: dark;
}

.drawer-date-input:focus {
  outline: none;
  border-color: var(--accent-lavender);
}

.drawer-hint {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.4;
}

.drawer-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  border-radius: var(--radius-md);
  color: var(--accent-lavender);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.drawer-action-btn:hover {
  background: rgba(196, 181, 253, 0.22);
}

.bells-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.bell-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 14px;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
}

.bell-row:last-child {
  border-bottom: none;
}

.bell-badge {
  color: var(--text-muted);
  font-weight: 600;
}

.bell-time {
  color: var(--text-main);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

/* Transitions */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.2s ease;
}

.drawer-fade-enter-active .drawer-panel,
.drawer-fade-leave-active .drawer-panel {
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-from .drawer-panel,
.drawer-fade-leave-to .drawer-panel {
  transform: translateX(100%);
}
</style>
