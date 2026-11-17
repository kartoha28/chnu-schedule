// Ключі, під якими ми будемо зберігати дані
const SETTINGS_KEY = 'app_settings';
const SCHEDULE_KEY = 'base_schedule';
const OVERRIDES_KEY = 'permanent_overrides';
const CALENDAR_KEY = 'calendar_events';

function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMondayLocal(date) {
    const localMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayOfWeek = localMidnight.getDay(); // 0 = Нд, 1 = Пн, ..., 6 = Сб
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    localMidnight.setDate(localMidnight.getDate() + diffToMonday);
    return localMidnight;
}

/**
 * Повертає дефолтну дату початку поточного семестру у форматі YYYY-MM-DD.
 * Серпень–січень -> 1 вересня (зі зміщенням на понеділок, якщо вихідний).
 * Лютий–липень -> 1 лютого (зі зміщенням на понеділок, якщо вихідний).
 */
export function getDefaultSemesterStartDate(now = new Date()) {
    const month = now.getMonth(); // 0..11
    const year = now.getFullYear();

    let targetDate;
    if (month >= 7 || month === 0) {
        const academicYear = month === 0 ? year - 1 : year;
        targetDate = new Date(academicYear, 8, 1); // 1 вересня
    } else {
        targetDate = new Date(year, 1, 1); // 1 лютого
    }

    const day = targetDate.getDay();
    if (day === 6) {
        targetDate.setDate(targetDate.getDate() + 2);
    } else if (day === 0) {
        targetDate.setDate(targetDate.getDate() + 1);
    }

    return formatLocalDate(targetDate);
}

/**
 * Обчислює поточний навчальний тиждень ('1-й тиждень' або '2-й тиждень')
 * відносно дати початку семестру (семестр завжди починається з 1-го тижня).
 */
export function calculateCurrentWeek(semesterStartDateStr, now = new Date()) {
    const dateStr = semesterStartDateStr || getDefaultSemesterStartDate(now);
    const parts = typeof dateStr === 'string' ? dateStr.split('-').map(Number) : [];
    if (parts.length !== 3 || parts.some(isNaN)) {
        return '1-й тиждень';
    }

    const [year, month, day] = parts;
    const startDate = new Date(year, month - 1, day);
    if (isNaN(startDate.getTime())) {
        return '1-й тиждень';
    }

    const startMonday = getMondayLocal(startDate);
    const currentMonday = getMondayLocal(now);

    const diffWeeks = Math.round(
        (currentMonday.getTime() - startMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)
    );

    return ((diffWeeks % 2) + 2) % 2 === 0 ? '1-й тиждень' : '2-й тиждень';
}

export const storage = {
    // --- НАЛАШТУВАННЯ (Група, вибіркові, поділи, дата початку семестру) ---
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
