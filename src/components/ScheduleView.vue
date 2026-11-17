<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storage } from '../utils/storage.js';

const props = defineProps({
  activeWeek: {
    type: String,
    required: true
  },
  currentRealWeek: {
    type: String,
    required: true
  }
});

const scheduleData = ref(null);

const allDaysOrder = ['Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
const dayShortNames = {
  'Понеділок': 'Пн',
  'Вівторок': 'Вт',
  'Середа': 'Ср',
  'Четвер': 'Чт',
  "П'ятниця": 'Пт',
  'Субота': 'Сб'
};

const activeDay = ref('Всі');

// Реальний час для підсвітки поточної / найближчої пари
const currentTimeMins = ref(0);
const currentDayName = ref('');
let timerId = null;

const pairTimes = {
  '1': { start: '08:20', end: '09:40', startM: 8 * 60 + 20, endM: 9 * 60 + 40 },
  '2': { start: '09:50', end: '11:10', startM: 9 * 60 + 50, endM: 11 * 60 + 10 },
  '3': { start: '11:30', end: '12:50', startM: 11 * 60 + 30, endM: 12 * 60 + 50 },
  '4': { start: '13:00', end: '14:20', startM: 13 * 60 + 0, endM: 14 * 60 + 20 },
  '5': { start: '14:40', end: '16:00', startM: 14 * 60 + 40, endM: 16 * 60 + 0 },
  '6': { start: '16:10', end: '17:30', startM: 16 * 60 + 10, endM: 17 * 60 + 30 },
  '7': { start: '17:40', end: '19:00', startM: 17 * 60 + 40, endM: 19 * 60 + 0 }
};

const updateTime = () => {
  const now = new Date();
  const daysMap = ['Неділя', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', "П'ятниця", 'Субота'];
  currentDayName.value = daysMap[now.getDay()];
  currentTimeMins.value = now.getHours() * 60 + now.getMinutes();
};

const availableDays = computed(() => {
  if (!scheduleData.value) return [];
  return allDaysOrder.filter((day) => {
    const w1 = scheduleData.value['1-й тиждень']?.[day];
    const w2 = scheduleData.value['2-й тиждень']?.[day];
    return (w1 && Object.keys(w1).length > 0) || (w2 && Object.keys(w2).length > 0);
  });
});

onMounted(() => {
  scheduleData.value = storage.getBaseSchedule();
  updateTime();

  if (availableDays.value.includes(currentDayName.value)) {
    activeDay.value = currentDayName.value;
  } else {
    activeDay.value = 'Всі';
  }

  timerId = setInterval(updateTime, 60000);
});

onUnmounted(() => {
  if (timerId) clearInterval(timerId);
});

const getPairsForDay = (day) => {
  const dayObj = scheduleData.value?.[props.activeWeek]?.[day];
  if (!dayObj) return [];
  return Object.entries(dayObj).sort((a, b) => Number(a[0]) - Number(b[0]));
};

const daysToRender = computed(() => {
  if (activeDay.value === 'Всі') {
    return availableDays.value.filter((day) => getPairsForDay(day).length > 0);
  }
  return [activeDay.value];
});

const formatPairsCount = (count) => {
  if (count === 0) return 'Пар немає';
  if (count === 1) return '1 пара';
  if (count >= 2 && count <= 4) return `${count} пари`;
  return `${count} пар`;
};

const getLessonTheme = (lesson) => {
  if (lesson.isElective) return 'theme-elective';
  if (lesson.type === 'lecture') return 'theme-lecture';
  return 'theme-lab';
};

const parseLessonMeta = (lesson) => {
  const rawSubject = lesson.subject || '';
  const groupMatch = rawSubject.match(/\[група\s*(\d+)\]/i);
  const groupBadge = groupMatch ? `Група ${groupMatch[1]}` : null;
  const cleanSubject = rawSubject.replace(/\[група\s*\d+\]/ig, '').replace(/\s+/g, ' ').trim();
  const typeLabel = lesson.type === 'lecture' ? 'Лекція' : 'Практика';

  return {
    cleanSubject,
    groupBadge,
    typeLabel
  };
};

const getLiveBadgeInfo = (day, pairIndex) => {
  if (props.activeWeek !== props.currentRealWeek) return null;
  if (day !== currentDayName.value) return null;

  const p = pairTimes[pairIndex];
  if (!p) return null;

  if (currentTimeMins.value >= p.startM && currentTimeMins.value <= p.endM) {
    return { status: 'now', text: 'Зараз' };
  }

  const diff = p.startM - currentTimeMins.value;
  if (diff > 0 && diff <= 20) {
    return { status: 'soon', text: `За ${diff} хв` };
  }

  return null;
};
</script>

<template>
  <div class="schedule-view">
    <div v-if="!scheduleData" class="empty-state">
      <p class="empty-title">Розклад відсутній</p>
      <p class="empty-subtitle">Відкрийте меню та імпортуйте файл розкладу.</p>
    </div>

    <div v-else class="schedule-content">
      <!-- Рядок вибору днів тижня (без чисел місяця) -->
      <nav class="day-bar" aria-label="Фільтр по днях тижня">
        <button
          type="button"
          class="day-tab"
          :class="{ 'is-active': activeDay === 'Всі' }"
          @click="activeDay = 'Всі'"
        >
          <span class="day-tab-label">Всі</span>
        </button>

        <button
          v-for="day in availableDays"
          :key="day"
          type="button"
          class="day-tab"
          :class="{
            'is-active': activeDay === day,
            'is-today': day === currentDayName
          }"
          :aria-label="day"
          @click="activeDay = day"
        >
          <span class="day-tab-label">{{ dayShortNames[day] || day.slice(0, 2) }}</span>
          <span v-if="day === currentDayName" class="today-dot" aria-hidden="true"></span>
        </button>
      </nav>

      <!-- Порожній тиждень -->
      <div v-if="daysToRender.length === 0" class="empty-state">
        <p class="empty-title">На «{{ activeWeek }}» пар немає</p>
        <p class="empty-subtitle">Спробуйте перемкнути тиждень у верхній панелі.</p>
      </div>

      <!-- Дні та пари -->
      <div v-else class="days-stack">
        <section v-for="day in daysToRender" :key="day" class="day-section">
          <div class="day-header">
            <div class="day-heading-wrap">
              <h2 class="day-heading">{{ day }}</h2>
              <span
                v-if="day === currentDayName && activeWeek === currentRealWeek"
                class="today-chip"
              >
                Сьогодні
              </span>
            </div>
            <span class="day-count">{{ formatPairsCount(getPairsForDay(day).length) }}</span>
          </div>

          <div v-if="getPairsForDay(day).length === 0" class="empty-day-card">
            У цей день пар немає — можна відпочити.
          </div>

          <div v-else class="pairs-list">
            <article
              v-for="[pairIndex, lesson] in getPairsForDay(day)"
              :key="pairIndex"
              class="lesson-card"
              :class="[
                getLessonTheme(lesson),
                { 'is-highlighted': Boolean(getLiveBadgeInfo(day, pairIndex)) }
              ]"
            >
              <!-- Ліва колонка часу -->
              <div class="time-col">
                <span class="time-text">{{ pairTimes[pairIndex]?.start || '—' }}</span>
                <span class="pair-badge">ПАРА {{ String(pairIndex).padStart(2, '0') }}</span>
                <span class="time-text">{{ pairTimes[pairIndex]?.end || '—' }}</span>
              </div>

              <!-- Вертикальний розділювач -->
              <div class="card-divider" aria-hidden="true"></div>

              <!-- Права колонка інформації -->
              <div class="info-col">
                <div class="badges-row">
                  <span class="meta-badge meta-badge--type">
                    {{ parseLessonMeta(lesson).typeLabel }}
                  </span>
                  <span v-if="lesson.isElective" class="meta-badge meta-badge--elective">
                    Вибіркова
                  </span>
                  <span
                    v-if="parseLessonMeta(lesson).groupBadge"
                    class="meta-badge meta-badge--group"
                  >
                    {{ parseLessonMeta(lesson).groupBadge }}
                  </span>
                  <span
                    v-if="getLiveBadgeInfo(day, pairIndex)"
                    class="meta-badge meta-badge--live"
                  >
                    <span class="live-dot" aria-hidden="true"></span>
                    {{ getLiveBadgeInfo(day, pairIndex).text }}
                  </span>
                </div>

                <h3 class="subject-title">{{ parseLessonMeta(lesson).cleanSubject }}</h3>

                <div class="meta-list">
                  <div v-if="lesson.teacher" class="meta-row">
                    <svg class="meta-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span class="meta-text">{{ lesson.teacher }}</span>
                  </div>

                  <div v-if="lesson.room" class="meta-row meta-row--room">
                    <svg class="meta-icon meta-icon--room" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span class="meta-text meta-text--room">{{ lesson.room }}</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-view {
  padding-top: 14px;
}

/* Day Switcher Bar */
.day-bar {
  display: flex;
  align-items: stretch;
  gap: 6px;
  margin-bottom: 18px;
  overflow-x: auto;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.day-bar::-webkit-scrollbar {
  display: none;
}

.day-tab {
  flex: 1 0 46px;
  min-height: 44px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 6px 8px;
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.day-tab:hover:not(.is-active) {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-main);
}

.day-tab.is-today:not(.is-active) {
  border-color: rgba(94, 234, 212, 0.35);
  color: var(--text-main);
}

.day-tab.is-active {
  background: var(--accent-lavender);
  border-color: var(--accent-lavender);
  color: var(--bg-app);
  font-weight: 700;
  box-shadow: 0 2px 12px var(--accent-lavender-glow);
}

.today-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--accent-teal);
}

.day-tab.is-active .today-dot {
  background: var(--bg-app);
}

/* Days Stack */
.days-stack {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.day-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.day-heading-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
}

.day-heading {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
}

.today-chip {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent-teal);
  background: var(--accent-teal-bg);
  border: 1px solid var(--accent-teal-border);
  padding: 2px 8px;
  border-radius: 999px;
}

.day-count {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.pairs-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Lesson Card */
.lesson-card {
  --card-accent: var(--accent-amber);
  --card-accent-bg: var(--accent-amber-bg);
  --card-accent-border: var(--accent-amber-border);
  --card-accent-glow: var(--accent-amber-glow);

  display: flex;
  align-items: stretch;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.lesson-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
}

/* 1. Лекція = Бірюза */
.lesson-card.theme-lecture {
  --card-accent: var(--accent-teal);
  --card-accent-bg: var(--accent-teal-bg);
  --card-accent-border: var(--accent-teal-border);
  --card-accent-glow: var(--accent-teal-glow);
}

/* 2. Практика / Лаба / Семінар = Бурштин */
.lesson-card.theme-lab {
  --card-accent: var(--accent-amber);
  --card-accent-bg: var(--accent-amber-bg);
  --card-accent-border: var(--accent-amber-border);
  --card-accent-glow: var(--accent-amber-glow);
}

/* 3. Вибіркова = Лаванда */
.lesson-card.theme-elective {
  --card-accent: var(--accent-lavender);
  --card-accent-bg: var(--accent-lavender-bg);
  --card-accent-border: var(--accent-lavender-border);
  --card-accent-glow: var(--accent-lavender-glow);
}

.lesson-card.is-highlighted {
  border-color: var(--card-accent);
  box-shadow: 0 0 0 1px var(--card-accent-border), 0 6px 22px var(--card-accent-glow);
}

/* Time Column */
.time-col {
  width: 92px;
  padding: 16px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-shrink: 0;
}

.time-text {
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.pair-badge {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--card-accent);
  background: var(--card-accent-bg);
  border: 1px solid var(--card-accent-border);
  padding: 4px 8px;
  border-radius: 7px;
  line-height: 1;
  white-space: nowrap;
}

/* Divider */
.card-divider {
  width: 1px;
  background: var(--border-color);
  margin: 14px 0;
  flex-shrink: 0;
}

/* Info Column */
.info-col {
  flex: 1;
  min-width: 0;
  padding: 15px 16px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.badges-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.meta-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  line-height: 1.35;
}

.meta-badge--type {
  color: var(--card-accent);
  background: var(--card-accent-bg);
  border: 1px solid var(--card-accent-border);
}

.lesson-card.theme-elective .meta-badge--type {
  color: var(--text-muted);
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--border-color);
}

.meta-badge--elective {
  color: var(--accent-lavender);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
}

.meta-badge--group {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color);
}

.meta-badge--live {
  color: var(--card-accent);
  background: var(--card-accent-bg);
  border: 1px solid var(--card-accent);
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 1.8s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.8);
  }
}

.subject-title {
  font-size: 15.5px;
  font-weight: 650;
  line-height: 1.35;
  color: var(--text-main);
  word-break: break-word;
}

.meta-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.meta-row {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  color: var(--text-muted);
  font-size: 13.5px;
  line-height: 1.35;
}

.meta-icon {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--text-dim);
}

.meta-icon--room {
  color: var(--card-accent);
}

.meta-text {
  min-width: 0;
  word-break: break-word;
}

.meta-text--room {
  color: var(--card-accent);
  font-weight: 500;
}

/* Empty States */
.empty-state,
.empty-day-card {
  background: var(--bg-surface);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-lg);
  padding: 28px 20px;
  text-align: center;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 4px;
}

.empty-subtitle,
.empty-day-card {
  font-size: 14px;
  color: var(--text-muted);
}

@media (max-width: 370px) {
  .time-col {
    width: 84px;
    padding: 14px 8px;
  }

  .info-col {
    padding: 14px 12px;
  }
}
</style>
