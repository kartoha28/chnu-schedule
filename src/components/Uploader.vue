<script setup>
import { ref, computed, onMounted } from 'vue';
import { parseScheduleFile, analyzeGroupSettings, extractScheduleForGroup } from '../utils/parser.js';
import { storage } from '../utils/storage.js'; // Підключаємо нашу базу даних

const emit = defineEmits(['scheduleSaved']);
const step = ref(1);
const statusMessage = ref('Оберіть файл розкладу (.xls)');

const groups = ref([]);
const selectedGroup = ref('');
const rawMatrixData = ref(null);
const groupsRow = ref(-1);

const availableElectives = ref([]);
const availableSplitSubjects = ref({});

const userElectives = ref([]);
const userSplitNumbers = ref({});

const finalScheduleJSON = ref(null);
const savedSettings = ref(null); // Тут тримаємо налаштування з минулого разу

// Коли компонент завантажується, відразу дістаємо налаштування з пам'яті
onMounted(() => {
  savedSettings.value = storage.getSettings();
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

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  statusMessage.value = `Читаємо файл...`;
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
      statusMessage.value = `Крок 1: Оберіть свою групу`;
    }
  } catch (error) {
    statusMessage.value = '❌ Помилка при читанні файлу!';
  }
};

const handleGroupSelect = () => {
  const analysis = analyzeGroupSettings(rawMatrixData.value, groupsRow.value, selectedGroup.value);

  availableElectives.value = analysis.electives;
  availableSplitSubjects.value = analysis.splitSubjects;

  const match = selectedGroup.value.match(/\((\d+)\)/);
  const defaultSubNum = match ? match[1] : "1";

  // Заповнюємо базовими номерами
  for (const subject in analysis.splitSubjects) {
    const groupsList = analysis.splitSubjects[subject];
    userSplitNumbers.value[subject] = groupsList.includes(defaultSubNum) ? defaultSubNum : groupsList[0];
  }

  // АВТОПІДСТАНОВКА 2: Якщо збережена група збігається з обраною, підтягуємо галочки
  if (savedSettings.value && savedSettings.value.mainGroup === selectedGroup.value) {

    // Відновлюємо галочки на вибіркових
    if (savedSettings.value.selectedElectives) {
      userElectives.value = savedSettings.value.selectedElectives.filter(e => availableElectives.value.includes(e));
    }

    // Відновлюємо номери підгруп
    if (savedSettings.value.splitGroupNumbers) {
      for (const subject in analysis.splitSubjects) {
        if (savedSettings.value.splitGroupNumbers[subject]) {
          userSplitNumbers.value[subject] = savedSettings.value.splitGroupNumbers[subject];
        }
      }
    }
  }

  step.value = 3;
  statusMessage.value = `Крок 2: Персоналізація розкладу`;
};

const handleGenerate = () => {
  const userSettings = {
    mainGroup: selectedGroup.value, // Запам'ятовуємо, яку групу обрали
    selectedElectives: userElectives.value,
    splitGroupNumbers: userSplitNumbers.value
  };

  const schedule = extractScheduleForGroup(rawMatrixData.value, groupsRow.value, selectedGroup.value, userSettings);
  finalScheduleJSON.value = JSON.stringify(schedule, null, 2);

  // ЗБЕРІГАЄМО ВСЕ У БРАУЗЕР!
  storage.saveSettings(userSettings);
  storage.saveBaseSchedule(schedule);

  // Оновлюємо локальну змінну, щоб не треба було перезавантажувати сторінку
  savedSettings.value = userSettings;

  step.value = 4;
  emit('scheduleSaved');
  statusMessage.value = `🎉 Розклад згенеровано і збережено!`;
};
</script>

<template>
  <div class="uploader-card">
    <h2>Імпорт таблиці</h2>
    <p class="status-msg">{{ statusMessage }}</p>

    <div v-if="step === 1">
      <input type="file" accept=".xls, .xlsx" @change="handleFileUpload" class="file-input" />
    </div>

    <div v-if="step === 2" class="step-container">
      <select v-model="selectedGroup">
        <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
      </select>
      <button @click="handleGroupSelect" class="action-btn">Далі ➔</button>
    </div>

    <div v-if="step === 3" class="step-container wizard">

      <!-- Блок ВИБІРКОВИХ -->
      <div v-if="availableElectives.length > 0" class="wizard-section">
        <h3>Обери свої вибіркові дисципліни:</h3>
        <div v-for="elective in availableElectives" :key="elective" class="elective-block">

          <label class="checkbox-label">
            <input type="checkbox" :value="elective" v-model="userElectives">
            {{ elective }}
          </label>

          <!-- З'являється ТІЛЬКИ якщо предмет вибрано галочкою І він має поділ на групи -->
          <div v-if="userElectives.includes(elective) && availableSplitSubjects[elective]" class="nested-select">
            <span>↳ Обери групу для цього предмета:</span>
            <select v-model="userSplitNumbers[elective]">
              <option v-for="num in availableSplitSubjects[elective]" :key="num" :value="num">Група {{ num }}</option>
            </select>
          </div>

        </div>
      </div>

      <!-- Блок ОБОВ'ЯЗКОВИХ предметів із поділом (напр. Англійська) -->
      <div v-if="Object.keys(mandatorySplitSubjects).length > 0" class="wizard-section">
        <h3>Уточни номер підгрупи для цих предметів:</h3>
        <div v-for="(groupsList, subject) in mandatorySplitSubjects" :key="subject" class="split-input">
          <span>{{ subject }}</span>
          <select v-model="userSplitNumbers[subject]">
            <option v-for="num in groupsList" :key="num" :value="num">Група {{ num }}</option>
          </select>
        </div>
      </div>

      <button @click="handleGenerate" class="action-btn generate-btn">Згенерувати розклад</button>
    </div>

    <div v-if="step === 4" class="json-preview">
      <pre>{{ finalScheduleJSON }}</pre>
    </div>
  </div>
</template>

<style scoped>
.uploader-card {
  border: 1px solid #ddd;
  border-radius: 16px;
  padding: 30px;
  margin: 20px auto;
  background: white;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}
.status-msg { font-weight: bold; color: #555; }
.step-container { display: flex; flex-direction: column; align-items: center; gap: 15px; margin-top: 20px; }
select { padding: 10px; border-radius: 8px; border: 1px solid #ccc; width: 100%; max-width: 300px; font-size: 15px;}
.action-btn { background: #007bff; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; }
.generate-btn { background: #28a745; margin-top: 15px; }

/* Стилі майстра */
.wizard { align-items: stretch; text-align: left; }
.wizard-section { background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 15px; }
.wizard-section h3 { margin-top: 0; font-size: 16px; color: #333; margin-bottom: 15px;}
.elective-block { margin-bottom: 15px; border-bottom: 1px dashed #ddd; padding-bottom: 10px;}
.elective-block:last-child { border-bottom: none; }
.checkbox-label { display: flex; align-items: center; gap: 10px; cursor: pointer; font-size: 15px; font-weight: 500;}
.checkbox-label input { width: 18px; height: 18px; cursor: pointer;}
.nested-select { margin-top: 10px; margin-left: 28px; display: flex; align-items: center; gap: 10px; font-size: 14px; color: #555;}
.nested-select select { max-width: 150px; padding: 5px; }
.split-input { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; border-bottom: 1px dashed #ccc; padding-bottom: 10px; font-size: 15px;}
.split-input select { max-width: 120px; }

.json-preview { margin-top: 20px; background: #282c34; color: #abb2bf; padding: 15px; border-radius: 8px; text-align: left; max-height: 400px; overflow-y: auto; font-size: 13px; }
</style>