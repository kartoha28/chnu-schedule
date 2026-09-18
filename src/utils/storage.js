// Ключі, під якими ми будемо зберігати дані
const SETTINGS_KEY = 'app_settings';
const SCHEDULE_KEY = 'base_schedule';
const OVERRIDES_KEY = 'permanent_overrides';
const CALENDAR_KEY = 'calendar_events';

export const storage = {
    // --- НАЛАШТУВАННЯ (Група, вибіркові, поділи) ---
    getSettings() {
        const data = localStorage.getItem(SETTINGS_KEY);
        return data ? JSON.parse(data) : null;
    },
    saveSettings(settings) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    },

    // --- БАЗОВИЙ РОЗКЛАД ---
    getBaseSchedule() {
        const data = localStorage.getItem(SCHEDULE_KEY);
        return data ? JSON.parse(data) : null;
    },
    saveBaseSchedule(schedule) {
        localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule));
    },

    // Тимчасові заглушки для майбутніх нотаток
    getOverrides() { return JSON.parse(localStorage.getItem(OVERRIDES_KEY) || '{}'); },
    saveOverrides(data) { localStorage.setItem(OVERRIDES_KEY, JSON.stringify(data)); },
    getCalendarEvents() { return JSON.parse(localStorage.getItem(CALENDAR_KEY) || '{}'); },
    saveCalendarEvents(data) { localStorage.setItem(CALENDAR_KEY, JSON.stringify(data)); }
};