<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import Uploader from './components/Uploader.vue';
import ScheduleView from './components/ScheduleView.vue';
import { storage, getDefaultSemesterStartDate, calculateCurrentWeek } from './utils/storage.js';

const hasSchedule = ref(false);
const showUploader = ref(false);
const showMenu = ref(false);
const showSettingsModal = ref(false);
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

const toggleWeek = () => {
  activeWeek.value = activeWeek.value === '1-й тиждень' ? '2-й тиждень' : '1-й тиждень';
};

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

const openSettingsModal = () => {
  showMenu.value = false;
  showSettingsModal.value = true;
};

const openUploaderFromSettings = () => {
  showSettingsModal.value = false;
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
  if (event.key !== 'Escape') return;
  if (showSettingsModal.value) {
    showSettingsModal.value = false;
  } else if (showMenu.value) {
    showMenu.value = false;
  }
};

watch([showMenu, showSettingsModal], ([menuOpen, modalOpen]) => {
  document.body.style.overflow = menuOpen || modalOpen ? 'hidden' : '';
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
    <!-- Компактна непрозора липка шапка -->
    <header class="top-bar" :class="{ 'has-bottom-border': !hasSchedule || showUploader }">
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
          <!-- Єдина кнопка-тумблер перемикання тижнів (виділення тільки заливкою) -->
          <button
            v-if="hasSchedule && !showUploader"
            type="button"
            class="week-switcher"
            :aria-label="`Перемкнути тиждень. Зараз обрано ${activeWeek}`"
            @click="toggleWeek"
          >
            <span
              class="week-pill"
              :class="{
                'is-active': activeWeek === '1-й тиждень',
                'is-current': currentRealWeek === '1-й тиждень'
              }"
              :title="currentRealWeek === '1-й тиждень' ? 'Поточний тиждень за календарем' : undefined"
            >
              1 тижд.
            </span>

            <span
              class="week-pill"
              :class="{
                'is-active': activeWeek === '2-й тиждень',
                'is-current': currentRealWeek === '2-й тиждень'
              }"
              :title="currentRealWeek === '2-й тиждень' ? 'Поточний тиждень за календарем' : undefined"
            >
              2 тижд.
            </span>
          </button>

          <!-- Кнопка Бургер-меню -->
          <button
            type="button"
            class="burger-btn"
            aria-label="Відкрити меню"
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

    <!-- Виїзне Бургер-меню (Drawer) -->
    <Transition name="drawer-fade">
      <div
        v-if="showMenu"
        class="drawer-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Меню додатку"
        @click.self="showMenu = false"
      >
        <aside class="drawer-panel">
          <div class="drawer-header">
            <h2 class="drawer-title">Меню</h2>
            <button
              type="button"
              class="icon-close-btn"
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
            <!-- Шапка профілю -->
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

            <!-- Розділи меню (готово під майбутні пункти: нотатки, дедлайни тощо) -->
            <div class="drawer-section">
              <div class="drawer-section-label">Розділи</div>
              <div class="menu-nav-list">
                <button
                  type="button"
                  class="menu-nav-item"
                  @click="openSettingsModal"
                >
                  <div class="menu-nav-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </div>
                  <div class="menu-nav-text">
                    <span class="menu-nav-title">Налаштування</span>
                    <span class="menu-nav-desc">Початок семестру та оновлення розкладу</span>
                  </div>
                  <svg class="menu-nav-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Позначення кольорів (Легенда) -->
            <div class="drawer-section">
              <div class="drawer-section-label">Позначення кольорів</div>
              <div class="legend-card">
                <div class="legend-row">
                  <span class="legend-chip legend-chip--lecture">ПАРА</span>
                  <div class="legend-info">
                    <span class="legend-title">Лекція</span>
                    <span class="legend-desc">Бірюзовий акцент і локація</span>
                  </div>
                </div>
                <div class="legend-row">
                  <span class="legend-chip legend-chip--lab">ПАРА</span>
                  <div class="legend-info">
                    <span class="legend-title">Практика / Лабораторна</span>
                    <span class="legend-desc">Бурштиновий акцент і локація</span>
                  </div>
                </div>
                <div class="legend-row">
                  <span class="legend-chip legend-chip--elective">Вибіркова</span>
                  <div class="legend-info">
                    <span class="legend-title">Вибіркова дисципліна</span>
                    <span class="legend-desc">Позначка справа знизу картки</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Розклад дзвінків ЧНУ -->
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

    <!-- Єдиний формат плаваючої картки для підрозділів (Налаштування) -->
    <Transition name="modal-fade">
      <div
        v-if="showSettingsModal"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Налаштування розкладу"
        @click.self="showSettingsModal = false"
      >
        <div class="modal-card">
          <div class="modal-header">
            <h2 class="modal-title">Налаштування</h2>
            <button
              type="button"
              class="icon-close-btn"
              aria-label="Закрити налаштування"
              @click="showSettingsModal = false"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- Початок семестру -->
            <div class="modal-section">
              <label class="drawer-section-label" for="modal-semester-date">
                Початок семестру (1-й тиждень)
              </label>
              <input
                id="modal-semester-date"
                type="date"
                class="modal-date-input"
                :value="semesterStartDateValue"
                @change="handleSemesterDateChange"
              />
              <p class="modal-hint">
                За цією датою сьогодні визначається як:
                <span class="modal-week-badge">{{ currentRealWeek }}</span>
              </p>
              <p class="modal-subhint">
                1-й тиждень відраховується з понеділка тижня, до якого належить обрана дата.
              </p>
            </div>

            <!-- Оновлення файлу розкладу -->
            <div class="modal-section">
              <div class="drawer-section-label">Таблиця розкладу</div>
              <button
                type="button"
                class="modal-action-btn"
                @click="openUploaderFromSettings"
              >
                <div class="modal-action-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div class="modal-action-text">
                  <span class="modal-action-title">
                    {{ hasSchedule ? 'Оновити розклад (.xls / .xlsx)' : 'Імпортувати таблицю розкладу' }}
                  </span>
                  <span class="modal-action-desc">
                    Завантажити новий файл, змінити групу або вибіркові
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
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

/* Top Bar — повністю непрозорий, фіксована висота 58px для безшовної стиковки зі списком днів */
.top-bar {
  position: sticky;
  top: 0;
  z-index: 40;
  height: 58px;
  background: var(--bg-app);
}

.top-bar.has-bottom-border {
  border-bottom: 1px solid var(--border-color);
}

.top-bar-inner {
  max-width: 600px;
  height: 100%;
  margin: 0 auto;
  padding: 0 16px;
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

/* Week Switcher — єдина кнопка-тумблер (спокійне виділення тільки заливкою) */
.week-switcher {
  display: inline-flex;
  align-items: center;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  padding: 3px;
  gap: 3px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.week-switcher:hover {
  border-color: var(--border-hover);
}

.week-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 11px;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  transition: background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}

/* Поточний календарний тиждень (коли переглядається інший) — спокійна бірюзова заливка без зеленого тексту та крапки */
.week-pill.is-current:not(.is-active) {
  background: rgba(94, 234, 212, 0.07);
}

/* Активний перегляданий тиждень */
.week-pill.is-active {
  background: #252a3b;
  color: var(--text-main);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.week-pill.is-active.is-current {
  border-color: rgba(94, 234, 212, 0.28);
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

.icon-close-btn {
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
  flex-shrink: 0;
  transition: all 0.15s ease;
}

.icon-close-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-main);
}

.drawer-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drawer-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drawer-section-label {
  font-size: 11.5px;
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

/* Menu Navigation List */
.menu-nav-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu-nav-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.menu-nav-item:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
}

.menu-nav-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  color: var(--accent-lavender);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.menu-nav-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.menu-nav-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.menu-nav-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.3;
}

.menu-nav-arrow {
  color: var(--text-dim);
  flex-shrink: 0;
}

/* Legend Card */
.legend-card {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.legend-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-color);
}

.legend-row:last-child {
  border-bottom: none;
}

.legend-chip {
  min-width: 68px;
  text-align: center;
  font-size: 10.5px;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 6px;
  flex-shrink: 0;
}

.legend-chip--lecture {
  color: var(--accent-teal);
  background: var(--accent-teal-bg);
  border: 1px solid var(--accent-teal-border);
}

.legend-chip--lab {
  color: var(--accent-amber);
  background: var(--accent-amber-bg);
  border: 1px solid var(--accent-amber-border);
}

.legend-chip--elective {
  color: var(--accent-lavender);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
}

.legend-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.legend-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-main);
}

.legend-desc {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.3;
}

/* Bells List */
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

/* Floating Modal Card (Стандарт для Налаштувань та майбутніх вікон) */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(5, 7, 11, 0.76);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.modal-card {
  width: 100%;
  max-width: 440px;
  max-height: 90dvh;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-color);
}

.modal-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-main);
}

.modal-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.modal-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.modal-date-input {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 11px 12px;
  color: var(--text-main);
  font-size: 14px;
  color-scheme: dark;
}

.modal-date-input:focus {
  outline: none;
  border-color: var(--accent-lavender);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.15);
}

.modal-hint {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.modal-week-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-teal);
  background: var(--accent-teal-bg);
  border: 1px solid var(--accent-teal-border);
}

.modal-subhint {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.4;
}

.modal-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-main);
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.modal-action-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--accent-lavender-border);
}

.modal-action-icon {
  width: 38px;
  height: 38px;
  border-radius: var(--radius-sm);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  color: var(--accent-lavender);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.modal-action-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.modal-action-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
}

.modal-action-desc {
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.35;
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

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.18s ease;
}

.modal-fade-enter-active .modal-card,
.modal-fade-leave-active .modal-card {
  transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-fade-enter-from .modal-card,
.modal-fade-leave-to .modal-card {
  transform: scale(0.96) translateY(8px);
}
</style>
