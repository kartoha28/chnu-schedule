<script setup>
import { ref, computed, onMounted } from 'vue';
import { parseScheduleFile, analyzeGroupSettings, extractScheduleForGroup } from '../utils/parser.js';
import { storage, getDefaultSemesterStartDate, calculateCurrentWeek } from '../utils/storage.js';

defineProps({
  canCancel: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['scheduleSaved', 'cancel']);

const step = ref(1);
const statusMessage = ref('Оберіть файл розкладу (.xls або .xlsx)');
const hasError = ref(false);
const isParsing = ref(false);
const fileName = ref('');

const groups = ref([]);
const selectedGroup = ref('');
const rawMatrixData = ref(null);
const groupsRow = ref(-1);

const semesterStartDate = ref(getDefaultSemesterStartDate());

const availableElectives = ref([]);
const availableSplitSubjects = ref({});

const userElectives = ref([]);
const userSplitNumbers = ref({});

const savedSettings = ref(null);

onMounted(() => {
  savedSettings.value = storage.getSettings();
  if (savedSettings.value?.semesterStartDate) {
    semesterStartDate.value = savedSettings.value.semesterStartDate;
  }
});

const calculatedTodayWeek = computed(() => {
  return calculateCurrentWeek(semesterStartDate.value);
});

const mandatorySplitSubjects = computed(() => {
  const result = {};
  for (const subject in availableSplitSubjects.value) {
    if (!availableElectives.value.includes(subject)) {
      result[subject] = availableSplitSubjects.value[subject];
    }
  }
  return result;
});

const stepTitle = computed(() => {
  if (step.value === 1) return 'Імпорт таблиці';
  if (step.value === 2) return 'Група та семестр';
  return 'Персоналізація';
});

const handleFileUpload = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  hasError.value = false;
  isParsing.value = true;
  fileName.value = file.name;
  statusMessage.value = 'Читаємо та розбираємо таблицю...';

  try {
    const result = await parseScheduleFile(file);
    if (result.availableGroups.length > 0) {
      groups.value = result.availableGroups;
      rawMatrixData.value = result.rawData;
      groupsRow.value = result.groupsRowIndex;

      // АВТОПІДСТАНОВКА 1: Якщо ми зберегли групу раніше, вибираємо її
      if (savedSettings.value && savedSettings.value.mainGroup && groups.value.includes(savedSettings.value.mainGroup)) {
        selectedGroup.value = savedSettings.value.mainGroup;
      } else {
        selectedGroup.value = groups.value[0];
      }

      step.value = 2;
      statusMessage.value = 'Оберіть свою підгрупу та дату початку семестру';
    } else {
      hasError.value = true;
      statusMessage.value = 'Не знайдено жодної групи у файлі. Перевірте формат таблиці ЧНУ.';
    }
  } catch (error) {
    hasError.value = true;
    statusMessage.value = 'Помилка при читанні файлу. Переконайтесь, що це .xls або .xlsx.';
  } finally {
    isParsing.value = false;
  }
};

const handleGroupSelect = () => {
  hasError.value = false;
  try {
    const analysis = analyzeGroupSettings(rawMatrixData.value, groupsRow.value, selectedGroup.value);

    availableElectives.value = analysis.electives;
    availableSplitSubjects.value = analysis.splitSubjects;

    userElectives.value = [];
    userSplitNumbers.value = {};

    const match = selectedGroup.value.match(/\((\d+)\)/);
    const defaultSubNum = match ? match[1] : '1';

    // Заповнюємо базовими номерами
    for (const subject in analysis.splitSubjects) {
      const groupsList = analysis.splitSubjects[subject];
      userSplitNumbers.value[subject] = groupsList.includes(defaultSubNum) ? defaultSubNum : groupsList[0];
    }

    // АВТОПІДСТАНОВКА 2: Якщо збережена група збігається з обраною, підтягуємо галочки
    if (savedSettings.value && savedSettings.value.mainGroup === selectedGroup.value) {
      if (savedSettings.value.selectedElectives) {
        userElectives.value = savedSettings.value.selectedElectives.filter(e =>
          availableElectives.value.includes(e)
        );
      }

      if (savedSettings.value.splitGroupNumbers) {
        for (const subject in analysis.splitSubjects) {
          const savedNum = savedSettings.value.splitGroupNumbers[subject];
          if (savedNum && analysis.splitSubjects[subject].includes(savedNum)) {
            userSplitNumbers.value[subject] = savedNum;
          }
        }
      }
    }

    step.value = 3;
    statusMessage.value = 'Позначте свої вибіркові дисципліни та підгрупи';
  } catch (error) {
    hasError.value = true;
    statusMessage.value = error?.message || 'Не вдалося проаналізувати налаштування групи.';
  }
};

const goBack = () => {
  hasError.value = false;
  if (step.value === 2) {
    step.value = 1;
    statusMessage.value = 'Оберіть файл розкладу (.xls або .xlsx)';
  } else if (step.value === 3) {
    step.value = 2;
    statusMessage.value = 'Оберіть свою підгрупу та дату початку семестру';
  }
};

const handleGenerate = () => {
  const userSettings = {
    ...(savedSettings.value || {}),
    mainGroup: selectedGroup.value,
    selectedElectives: [...userElectives.value],
    splitGroupNumbers: { ...userSplitNumbers.value },
    semesterStartDate: semesterStartDate.value || getDefaultSemesterStartDate()
  };

  const schedule = extractScheduleForGroup(
    rawMatrixData.value,
    groupsRow.value,
    selectedGroup.value,
    userSettings
  );

  storage.saveSettings(userSettings);
  storage.saveBaseSchedule(schedule);

  savedSettings.value = userSettings;
  statusMessage.value = 'Розклад згенеровано і збережено!';
  emit('scheduleSaved');
};
</script>

<template>
  <section class="wizard-shell">
    <div class="wizard-card">
      <!-- Шапка майстра -->
      <div class="wizard-header">
        <div class="wizard-header-top">
          <div class="step-pill">Крок {{ step }} з 3</div>
          <button
            v-if="canCancel"
            type="button"
            class="cancel-link-btn"
            @click="emit('cancel')"
          >
            До розкладу
          </button>
        </div>

        <div class="step-progress" aria-hidden="true">
          <div class="step-progress-bar" :style="{ width: `${(step / 3) * 100}%` }"></div>
        </div>

        <h2 class="wizard-title">{{ stepTitle }}</h2>
        <p class="wizard-subtitle" :class="{ 'is-error': hasError }">{{ statusMessage }}</p>
      </div>

      <!-- Крок 1: Завантаження файлу -->
      <div v-if="step === 1" class="step-body">
        <label class="upload-dropzone" :class="{ 'is-loading': isParsing }">
          <input
            type="file"
            accept=".xls, .xlsx"
            class="file-input-hidden"
            :disabled="isParsing"
            @change="handleFileUpload"
          />
          <div class="upload-icon-box">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <path d="M12 18v-6" />
              <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
            </svg>
          </div>
          <div class="upload-text">
            <span class="upload-primary">{{ isParsing ? 'Обробляємо файл...' : 'Натисніть, щоб обрати таблицю' }}</span>
            <span class="upload-hint">Підтримуються файли Excel (.xls, .xlsx) з розкладом ЧНУ</span>
          </div>
        </label>

        <div v-if="savedSettings?.mainGroup" class="saved-hint-card">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <span>Попередній вибір групи <strong>{{ savedSettings.mainGroup }}</strong> та дисциплін підтягнеться автоматично.</span>
        </div>
      </div>

      <!-- Крок 2: Група та дата початку семестру -->
      <div v-if="step === 2" class="step-body">
        <div v-if="fileName" class="file-chip">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span class="file-chip-name">{{ fileName }}</span>
        </div>

        <div class="form-group">
          <label class="field-label" for="group-select">Ваша підгрупа</label>
          <select id="group-select" v-model="selectedGroup" class="field-control">
            <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="field-label" for="semester-start-date">Дата початку семестру (1-й тиждень)</label>
          <input
            id="semester-start-date"
            v-model="semesterStartDate"
            type="date"
            class="field-control"
          />
          <p class="field-help">
            За цією датою сьогодні визначається як:
            <span class="week-preview-badge">{{ calculatedTodayWeek }}</span>
          </p>
        </div>

        <div class="wizard-actions">
          <button type="button" class="btn-secondary" @click="goBack">
            Назад
          </button>
          <button type="button" class="btn-primary" @click="handleGroupSelect">
            Далі
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Крок 3: Вибіркові та підгрупи -->
      <div v-if="step === 3" class="step-body">
        <div v-if="availableElectives.length > 0" class="wizard-section">
          <h3 class="section-heading">Вибіркові дисципліни</h3>
          <div class="elective-list">
            <div v-for="elective in availableElectives" :key="elective" class="elective-item">
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  :value="elective"
                  v-model="userElectives"
                  class="custom-checkbox"
                />
                <span class="checkbox-text">{{ elective }}</span>
              </label>

              <div
                v-if="userElectives.includes(elective) && availableSplitSubjects[elective]"
                class="nested-group-picker"
              >
                <span class="nested-label">Підгрупа:</span>
                <select v-model="userSplitNumbers[elective]" class="field-control field-control--compact">
                  <option v-for="num in availableSplitSubjects[elective]" :key="num" :value="num">
                    Група {{ num }}
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div v-if="Object.keys(mandatorySplitSubjects).length > 0" class="wizard-section">
          <h3 class="section-heading">Предмети з поділом на групи</h3>
          <div class="split-list">
            <div v-for="(groupsList, subject) in mandatorySplitSubjects" :key="subject" class="split-row">
              <span class="split-subject">{{ subject }}</span>
              <select v-model="userSplitNumbers[subject]" class="field-control field-control--compact">
                <option v-for="num in groupsList" :key="num" :value="num">
                  Група {{ num }}
                </option>
              </select>
            </div>
          </div>
        </div>

        <div
          v-if="availableElectives.length === 0 && Object.keys(mandatorySplitSubjects).length === 0"
          class="empty-personalization"
        >
          Для групи <strong>{{ selectedGroup }}</strong> додаткових вибіркових або поділів не знайдено. Можна одразу формувати розклад.
        </div>

        <div class="wizard-actions">
          <button type="button" class="btn-secondary" @click="goBack">
            Назад
          </button>
          <button type="button" class="btn-primary btn-primary--success" @click="handleGenerate">
            Зберегти розклад
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wizard-shell {
  padding: 16px 0 32px;
}

.wizard-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-card);
}

.wizard-header {
  margin-bottom: 20px;
}

.wizard-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.step-pill {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-lavender);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  padding: 4px 10px;
  border-radius: 999px;
}

.cancel-link-btn {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.cancel-link-btn:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-main);
}

.step-progress {
  height: 4px;
  background: var(--bg-input);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 16px;
}

.step-progress-bar {
  height: 100%;
  background: var(--accent-lavender);
  border-radius: 999px;
  transition: width 0.25s ease;
}

.wizard-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.wizard-subtitle {
  font-size: 14px;
  color: var(--text-muted);
}

.wizard-subtitle.is-error {
  color: var(--accent-danger);
  font-weight: 500;
}

.step-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Dropzone */
.upload-dropzone {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 12px;
  padding: 32px 20px;
  background: var(--bg-input);
  border: 1.5px dashed var(--border-hover);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-dropzone:hover {
  border-color: var(--accent-lavender);
  background: rgba(196, 181, 253, 0.05);
}

.upload-dropzone.is-loading {
  opacity: 0.7;
  cursor: wait;
}

.file-input-hidden {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.upload-icon-box {
  width: 52px;
  height: 52px;
  border-radius: var(--radius-md);
  background: var(--accent-lavender-bg);
  border: 1px solid var(--accent-lavender-border);
  color: var(--accent-lavender);
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.upload-primary {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-main);
}

.upload-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.saved-hint-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(94, 234, 212, 0.08);
  border: 1px solid rgba(94, 234, 212, 0.22);
  border-radius: var(--radius-md);
  color: var(--accent-teal);
  font-size: 13px;
  line-height: 1.45;
}

.saved-hint-card svg {
  flex-shrink: 0;
  margin-top: 2px;
}

/* File chip */
.file-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  max-width: 100%;
  padding: 6px 12px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 12px;
}

.file-chip-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Form controls */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
}

.field-control {
  width: 100%;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 11px 12px;
  color: var(--text-main);
  font-size: 15px;
  color-scheme: dark;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.field-control:focus {
  outline: none;
  border-color: var(--accent-lavender);
  box-shadow: 0 0 0 3px rgba(196, 181, 253, 0.15);
}

.field-control--compact {
  width: auto;
  min-width: 124px;
  padding: 7px 10px;
  font-size: 13px;
}

.field-help {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
  color: var(--text-muted);
}

.week-preview-badge {
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

/* Personalization sections */
.wizard-section {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 14px;
}

.section-heading {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-main);
  margin-bottom: 12px;
}

.elective-list,
.split-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.elective-item {
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.elective-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.checkbox-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.custom-checkbox {
  appearance: none;
  -webkit-appearance: none;
  flex-shrink: 0;
  width: 19px;
  height: 19px;
  margin-top: 2px;
  background-color: var(--bg-input);
  border: 1.5px solid var(--border-hover);
  border-radius: 5px;
  cursor: pointer;
  display: grid;
  place-content: center;
  transition: all 0.15s ease;
}

.custom-checkbox::before {
  content: '';
  width: 10px;
  height: 10px;
  transform: scale(0);
  transition: transform 0.12s ease-in-out;
  box-shadow: inset 1em 1em var(--bg-app);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.custom-checkbox:checked {
  background-color: var(--accent-lavender);
  border-color: var(--accent-lavender);
}

.custom-checkbox:checked::before {
  transform: scale(1);
}

.checkbox-text {
  font-size: 14px;
  color: var(--text-main);
  line-height: 1.4;
}

.nested-group-picker {
  margin-top: 10px;
  margin-left: 29px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.nested-label {
  font-size: 13px;
  color: var(--text-muted);
}

.split-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.split-row:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.split-subject {
  font-size: 14px;
  color: var(--text-main);
  line-height: 1.35;
}

.empty-personalization {
  padding: 16px;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* Actions */
.wizard-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 4px;
}

.btn-secondary,
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 11px 18px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-secondary {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.btn-secondary:hover {
  background: var(--bg-card-hover);
  border-color: var(--border-hover);
  color: var(--text-main);
}

.btn-primary {
  flex: 1;
  background: var(--accent-lavender);
  border: 1px solid transparent;
  color: var(--bg-app);
}

.btn-primary:hover {
  filter: brightness(1.06);
}

.btn-primary:active {
  transform: scale(0.99);
}

.btn-primary--success {
  background: var(--accent-teal);
}
</style>
