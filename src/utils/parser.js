import * as XLSX from 'xlsx';

// Функція-праска: розгортає об'єднані комірки, дублюючи значення
function fillMergedCells(sheet) {
    if (!sheet['!merges']) return;

    sheet['!merges'].forEach(range => {
        // Знаходимо ліву верхню комірку об'єднання і беремо її значення
        const topLeftCellAddress = XLSX.utils.encode_cell({ r: range.s.r, c: range.s.c });
        const topLeftCell = sheet[topLeftCellAddress];
        const cellValue = topLeftCell ? topLeftCell.v : null;

        if (cellValue !== null) {
            // Проходимось по всіх комірках, які входять у це об'єднання, і записуємо туди текст
            for (let R = range.s.r; R <= range.e.r; ++R) {
                for (let C = range.s.c; C <= range.e.c; ++C) {
                    const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
                    if (!sheet[cellAddress]) {
                        sheet[cellAddress] = { t: 's', v: cellValue };
                    } else {
                        sheet[cellAddress].v = cellValue;
                    }
                }
            }
        }
    });
}

export async function parseScheduleFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];

                // 1. Запускаємо нашу праску для об'єднаних комірок
                fillMergedCells(sheet);

                // 2. Перетворюємо аркуш у масив
                const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                // 3. Шукаємо доступні підгрупи
                let groupsRowIndex = -1;
                let availableGroups = [];

                // Шукаємо в перших 20 рядках слово "підгрупи"
                for (let i = 0; i < 20; i++) {
                    // Якщо рядок існує і містить "підгрупи" (незалежно від регістру)
                    if (rawData[i] && rawData[i].some(cell => cell && cell.toString().toLowerCase().includes("підгрупи"))) {
                        groupsRowIndex = i;
                        // Забираємо всі комірки з цього рядка, викидаємо пусті та саме слово "підгрупи"
                        availableGroups = rawData[i].filter(cell =>
                            cell &&
                            cell.toString().toLowerCase().trim() !== "підгрупи" &&
                            cell.toString().trim() !== ""
                        );
                        break; // Знайшли рядок - зупиняємо пошук
                    }
                }

                resolve({ rawData, availableGroups, groupsRowIndex });
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = (error) => reject(error);
        reader.readAsArrayBuffer(file);
    });
}

// ... тут залишаються твої старі функції fillMergedCells та parseScheduleFile ...

// 1. Аналізує групу і знаходить всі вибіркові та доступні номери підгруп
export function analyzeGroupSettings(rawData, groupsRowIndex, selectedGroup) {
    const headerRow = rawData[groupsRowIndex];
    let targetCol = -1;
    for (let c = 0; c < headerRow.length; c++) {
        if (headerRow[c] === selectedGroup) { targetCol = c; break; }
    }
    if (targetCol === -1) throw new Error("Не вдалося знайти колонку для обраної групи");

    // ВИПРАВЛЕННЯ МЕЖ: Дивимося на рядок вище (там де "групи 343А+..."), щоб не вийти за межі курсу
    const courseHeaderRow = rawData[groupsRowIndex - 1];
    const courseName = courseHeaderRow[targetCol];

    let startCol = targetCol;
    while (startCol > 1 && courseHeaderRow[startCol - 1] === courseName) startCol--;

    let endCol = targetCol;
    while (endCol < headerRow.length - 1 && courseHeaderRow[endCol + 1] === courseName) endCol++;

    let electives = new Set();
    let splitSubjectsMap = {};

    for (let r = groupsRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row) continue;

        // Шукаємо ТІЛЬКИ в межах нашого курсу (від startCol до endCol)
        for (let c = startCol; c <= endCol; c++) {
            if (!row[c]) continue;
            let val = row[c].toString();

            let isElective = val.toUpperCase().includes("[ВИБІРКОВА]");
            let cleanName = val.replace(/\[ВИБІРКОВА\]/ig, '').replace(/\[ЛЕКЦІЯ\]/ig, '').split(/\[група/i)[0].trim();

            if (isElective && cleanName) electives.add(cleanName);

            let groupMatch = val.match(/\[група\s*(\d+)\]/i);
            if (groupMatch && cleanName) {
                if (!splitSubjectsMap[cleanName]) splitSubjectsMap[cleanName] = new Set();
                splitSubjectsMap[cleanName].add(groupMatch[1]);
            }
        }
    }

    let splitObj = {};
    for (let key in splitSubjectsMap) {
        splitObj[key] = Array.from(splitSubjectsMap[key]).sort((a, b) => a - b);
    }

    return {
        electives: Array.from(electives),
        splitSubjects: splitObj
    };
}

// 2. Генерація розкладу
export function extractScheduleForGroup(rawData, groupsRowIndex, selectedGroup, userSettings) {
    // Захист від пустих налаштувань
    userSettings = userSettings || {};
    userSettings.selectedElectives = userSettings.selectedElectives || [];
    userSettings.splitGroupNumbers = userSettings.splitGroupNumbers || {};

    const headerRow = rawData[groupsRowIndex];
    let targetCol = -1;
    for (let c = 0; c < headerRow.length; c++) {
        if (headerRow[c] === selectedGroup) { targetCol = c; break; }
    }

    const courseHeaderRow = rawData[groupsRowIndex - 1];
    const courseName = courseHeaderRow[targetCol];

    let startCol = targetCol;
    while (startCol > 1 && courseHeaderRow[startCol - 1] === courseName) startCol--;

    let endCol = targetCol;
    while (endCol < headerRow.length - 1 && courseHeaderRow[endCol + 1] === courseName) endCol++;

    const match = selectedGroup.match(/\((\d+)\)/);
    const mainSubGroupNum = match ? match[1] : null;

    const schedule = { "1-й тиждень": {}, "2-й тиждень": {} };
    const days = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];

    let currentDay = null;
    let pairsData = [];
    let currentPairObj = null;
    let lastDayPair = "";

    for (let r = groupsRowIndex + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        let col0 = row[0] ? row[0].toString().trim() : "";
        let col1 = row[1] ? row[1].toString().trim() : "";

        if (days.includes(col0)) currentDay = col0;
        let parsedPair = parseInt(col1);
        if (!isNaN(parsedPair)) {
            let currentDayPair = `${currentDay}_${parsedPair}`;
            if (currentDayPair !== lastDayPair) {
                lastDayPair = currentDayPair;
                currentPairObj = { day: currentDay, pair: parsedPair.toString(), rows: [] };
                pairsData.push(currentPairObj);
            }
        }
        if (currentPairObj) currentPairObj.rows.push(row);
    }

    for (const pairBlock of pairsData) {
        let activeCol = targetCol;
        let isElectivePair = false;

        // 1. Шукаємо "нашу" колонку (вибіркову або підгрупу) по ВСЬОМУ КУРСУ
        for (const row of pairBlock.rows) {
            for (let c = startCol; c <= endCol; c++) {
                if (!row[c]) continue;
                let val = row[c].toString();

                let isElect = val.toUpperCase().includes("[ВИБІРКОВА]");
                let splitMatch = val.match(/\[група\s*(\d+)\]/i);
                let cleanName = val.replace(/\[ВИБІРКОВА\]/ig, '').replace(/\[ЛЕКЦІЯ\]/ig, '').split(/\[група/i)[0].trim();

                // Якщо це вибіркова, і ми її обрали
                if (isElect) {
                    if (userSettings.selectedElectives.includes(cleanName)) {
                        if (splitMatch) {
                            let expectedGroup = userSettings.splitGroupNumbers[cleanName] || mainSubGroupNum;
                            if (splitMatch[1] === expectedGroup.toString()) {
                                activeCol = c;
                                isElectivePair = true;
                            }
                        } else {
                            activeCol = c;
                            isElectivePair = true;
                        }
                    }
                }
                // Якщо це просто предмет із поділом на групи
                else if (splitMatch) {
                    let expectedGroup = userSettings.splitGroupNumbers[cleanName] || mainSubGroupNum;
                    if (splitMatch[1] === expectedGroup.toString()) {
                        activeCol = c;
                    }
                }
            }
        }

        // 2. Перевіряємо, чи не залишилась у нашій активній колонці ЧУЖА вибіркова
        let containsUnselectedElective = false;
        for (const row of pairBlock.rows) {
            if (row[activeCol]) {
                let val = row[activeCol].toString();
                if (val.toUpperCase().includes("[ВИБІРКОВА]")) {
                    let cleanName = val.replace(/\[ВИБІРКОВА\]/ig, '').replace(/\[ЛЕКЦІЯ\]/ig, '').split(/\[група/i)[0].trim();
                    if (!userSettings.selectedElectives.includes(cleanName)) {
                        containsUnselectedElective = true;
                    } else {
                        isElectivePair = true;
                        containsUnselectedElective = false;
                    }
                }
            }
        }

        // Якщо це чужа вибіркова - просто скипаємо цю пару
        if (containsUnselectedElective && !isElectivePair) {
            continue;
        }

        // 3. Збираємо дані для 1-го і 2-го тижня
        let w1_rows = [], w2_rows = [];
        for (const row of pairBlock.rows) {
            let col2 = row[2] ? row[2].toString().trim() : "";
            if (col2.includes("2-й")) w2_rows.push(row);
            else w1_rows.push(row);
        }

        const getVals = (rows) => {
            let vals = [];
            for (const row of rows) {
                if (row[activeCol]) {
                    let cleanText = row[activeCol].toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
                    cleanText = cleanText.replace(/\[ВИБІРКОВА\]/ig, '').trim();

                    if (cleanText && !vals.includes(cleanText)) vals.push(cleanText);
                }
            }
            return vals;
        };

        let w1_vals = getVals(w1_rows);
        let w2_vals = getVals(w2_rows);

        let isSingleClass = false;
        if (w1_vals.length > 0 && w2_vals.length > 0) {
            let union = [...new Set([...w1_vals, ...w2_vals])];
            let boundaryMerge = (w1_rows.length > 0 && w2_rows.length > 0 && w1_rows[w1_rows.length-1][activeCol] && w2_rows[0][activeCol] && w1_rows[w1_rows.length-1][activeCol] === w2_rows[0][activeCol]);
            if (union.length <= 3 || boundaryMerge) isSingleClass = true;
        }

        const assignToSchedule = (week, vals) => {
            if (vals.length === 0) return;

            let subject = vals[0] || "";
            let teacher = vals[1] || "";
            let room = vals.slice(2).join(", ") || "";

            let type = "lab";
            if (subject.toUpperCase().includes("[ЛЕКЦІЯ]")) {
                type = "lecture";
                subject = subject.replace(/\[ЛЕКЦІЯ\]/ig, '').trim();
            }

            if (!schedule[week][pairBlock.day]) schedule[week][pairBlock.day] = {};

            schedule[week][pairBlock.day][pairBlock.pair] = {
                subject: subject,
                teacher: teacher,
                room: room,
                type: type,
                isElective: isElectivePair
            };
        };

        if (isSingleClass) {
            let union = [...new Set([...w1_vals, ...w2_vals])];
            assignToSchedule("1-й тиждень", union);
            assignToSchedule("2-й тиждень", union);
        } else {
            assignToSchedule("1-й тиждень", w1_vals);
            assignToSchedule("2-й тиждень", w2_vals);
        }
    }

    return schedule;
}