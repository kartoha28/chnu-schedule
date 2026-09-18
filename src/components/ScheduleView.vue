<script setup>
import { ref, onMounted } from 'vue';
import { storage } from '../utils/storage.js';

// Стан компонента
const scheduleData = ref(null);
const activeWeek = ref('1-й тиждень');
const daysOrder = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

// При завантаженні компонента беремо дані з localStorage
onMounted(() => {
  scheduleData.value = storage.getBaseSchedule();
});

// Допоміжна функція для визначення часу пари
const getPairTime = (pairIndex) => {
  const times = {
    "1": "08:20 - 09:40",
    "2": "09:50 - 11:10",
    "3": "11:30 - 12:50",
    "4": "13:00 - 14:20",
    "5": "14:40 - 16:00",
    "6": "16:10 - 17:30",
    "7": "17:40 - 19:00"
  };
  return times[pairIndex] || "";
};
</script>

<template>
  <div class="schedule-wrapper">
    <div v-if="!scheduleData" class="empty-state">
      <p>Розклад відсутній. Завантажте файл таблиці!</p>
    </div>

    <div v-else class="schedule-content">
      <!-- Перемикач тижнів -->
      <div class="week-tabs">
        <button
            @click="activeWeek = '1-й тиждень'"
            :class="{ active: activeWeek === '1-й тиждень' }"
        >1-й тиждень</button>
        <button
            @click="activeWeek = '2-й тиждень'"
            :class="{ active: activeWeek === '2-й тиждень' }"
        >2-й тиждень</button>
      </div>

      <!-- Відмальовуємо дні тижня -->
      <div class="days-container">
        <div v-for="day in daysOrder" :key="day" class="day-block">

          <!-- Показуємо день, тільки якщо в ньому є пари -->
          <template v-if="scheduleData[activeWeek] && scheduleData[activeWeek][day]">
            <h3 class="day-title">{{ day }}</h3>

            <div class="pairs-list">
              <!-- Відмальовуємо кожну пару в цьому дні -->
              <div
                  v-for="(lesson, pairIndex) in scheduleData[activeWeek][day]"
                  :key="pairIndex"
                  class="lesson-card"
                  :class="lesson.type === 'lecture' ? 'is-lecture' : 'is-lab'"
              >
                <div class="time-block">
                  <span class="pair-number">{{ pairIndex }}</span>
                  <span class="pair-time">{{ getPairTime(pairIndex) }}</span>
                </div>

                <div class="info-block">
                  <div class="subject">
                    {{ lesson.subject }}
                    <span v-if="lesson.isElective" class="badge elective">Вибіркова</span>
                    <span v-if="lesson.type === 'lecture'" class="badge lecture">Лекція</span>
                  </div>
                  <div class="meta">
                    <span class="teacher">👤 {{ lesson.teacher }}</span>
                    <span class="room">🚪 {{ lesson.room }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-wrapper { margin-top: 20px; text-align: left; }
.empty-state { text-align: center; color: #888; padding: 40px; border: 2px dashed #ddd; border-radius: 12px; }

/* Таби тижнів */
.week-tabs { display: flex; justify-content: center; gap: 10px; margin-bottom: 20px; }
.week-tabs button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; background: #e0e0e0; color: #333; font-weight: bold; transition: 0.2s; }
.week-tabs button.active { background: #007bff; color: white; }

/* Контейнер днів */
.days-container { display: flex; flex-direction: column; gap: 20px; }
.day-title { font-size: 20px; color: #2c3e50; border-bottom: 2px solid #eee; padding-bottom: 5px; margin-bottom: 15px; }

/* Картка пари */
.lesson-card { display: flex; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); margin-bottom: 12px; overflow: hidden; border-left: 6px solid #ccc; }
.lesson-card.is-lecture { border-left-color: #9b59b6; } /* Фіолетовий для лекцій */
.lesson-card.is-lab { border-left-color: #3498db; } /* Синій для лаб/практик */

.time-block { background: #f8f9fa; padding: 12px; display: flex; flex-direction: column; justify-content: center; align-items: center; min-width: 80px; border-right: 1px solid #eee; }
.pair-number { font-size: 20px; font-weight: bold; color: #333; }
.pair-time { font-size: 12px; color: #777; white-space: nowrap; }

.info-block { padding: 12px 16px; flex-grow: 1; }
.subject { font-size: 16px; font-weight: 600; color: #2c3e50; margin-bottom: 8px; line-height: 1.4; }
.meta { display: flex; flex-wrap: wrap; gap: 15px; font-size: 14px; color: #555; }

/* Бейджі */
.badge { font-size: 11px; padding: 3px 6px; border-radius: 4px; margin-left: 8px; vertical-align: middle; font-weight: normal; }
.badge.elective { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }
.badge.lecture { background: #f3e5f5; color: #6a1b9a; border: 1px solid #e1bee7; }
</style>