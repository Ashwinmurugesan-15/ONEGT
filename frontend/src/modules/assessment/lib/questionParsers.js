import Papa from 'papaparse';

const generateId = () => Math.random().toString(36).substring(2, 9);

/**
 * Parses CSV content into Question objects.
 */
export const parseCSV = (content) => {
    return new Promise((resolve) => {
        Papa.parse(content, {
            header: true,
            skipEmptyLines: 'greedy',
            complete: (results) => {
                const questions = [];
                results.data.forEach((rawRow) => {
                    const row = {};
                    Object.keys(rawRow).forEach(key => {
                        const normalizedKey = key.trim().toLowerCase()
                            .replace(/\s+/g, '_')
                            .replace(/[.()]/g, '');
                        row[normalizedKey] = rawRow[key];
                    });

                    const qText = row.question || row.text || row.q || row.question_text;
                    const optA = row.option_a || row.optiona || row.a || row.option_1;
                    const optB = row.option_b || row.optionb || row.b || row.option_2;
                    const optC = row.option_c || row.optionc || row.c || row.option_3;
                    const optD = row.option_d || row.optiond || row.d || row.option_4;
                    const answer = (row.answer || row.correct || row.correct_option || row.ans || '').toString().trim().toUpperCase();

                    if (qText && qText.toString().trim().length > 0) {
                        questions.push({
                            id: generateId(),
                            text: qText.toString().trim(),
                            options: [
                                { id: 'A', text: (optA || '').toString().trim() },
                                { id: 'B', text: (optB || '').toString().trim() },
                                { id: 'C', text: (optC || '').toString().trim() },
                                { id: 'D', text: (optD || '').toString().trim() },
                            ].filter(o => o.text.length > 0),
                            correct_option_id: ['A', 'B', 'C', 'D'].includes(answer) ? answer : 'A',
                        });
                    }
                });
                resolve(questions);
            }
        });
    });
};

/**
 * Parses plain text content using heuristics.
 */
export const parseTextHeuristic = (content) => {
    if (!content || content.trim().length === 0) return [];

    const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const questions = [];
    let current = null;

    const questionStartRegex = /^(?:Q\s*\d+|Question\s*\d+|\d+)\s*[.:)]\s*(.+)/i;
    const optionStartRegex = /^\s*([A-Da-d])\s*[.:)]\s*(.+)|^\s*\(([A-Da-d])\)\s*(.+)/i;
    const answerRegex = /^\s*(?:Ans|Answer|Correct|Correct\s*Option|Correct\s*Answer|Answer\s*Key)[\s:-]*([A-D])/i;

    for (const line of lines) {
        if (/^\d+$/.test(line) || /^Page\s+\d+/i.test(line)) continue;

        const answerMatch = line.match(answerRegex);
        if (answerMatch && current) {
            current.correct_option_id = answerMatch[1].toUpperCase();
            continue;
        }

        const optionMatch = line.match(optionStartRegex);
        if (optionMatch && current) {
            const optId = (optionMatch[1] || optionMatch[3]).toUpperCase();
            const optText = (optionMatch[2] || optionMatch[4]).trim();
            if (!current.options) current.options = [];
            current.options.push({ id: optId, text: optText });
            continue;
        }

        const questionMatch = line.match(questionStartRegex);
        if (questionMatch) {
            if (current && current.text && current.options?.length > 1) {
                if (!current.correct_option_id) current.correct_option_id = current.options[0].id;
                questions.push(current);
            }
            current = {
                id: generateId(),
                text: questionMatch[1].trim(),
                options: [],
            };
            continue;
        }

        if (current && (!current.options || current.options.length === 0)) {
            current.text += ' ' + line;
        }
    }

    if (current && current.text && current.options?.length > 1) {
        if (!current.correct_option_id) current.correct_option_id = current.options[0].id;
        questions.push(current);
    }

    // fallback for mashed content (simplified)
    if (questions.length === 0) {
        return parseMashedContent(content);
    }

    return questions;
};

const parseMashedContent = (content) => {
    const questions = [];
    const mashedRegex = /([^?]+)\?\s*(.+?)([A-D])(?=\s*[A-Z]|$)/g;
    let match;
    while ((match = mashedRegex.exec(content)) !== null) {
        const qText = match[1].trim();
        const optionsRaw = match[2].trim();
        const answer = match[3];

        if (qText.length < 5) continue;

        const optionsSplit = optionsRaw.split(/(?=[A-Z])/).filter(s => s.trim().length > 0);
        let options = optionsSplit.slice(0, 4).map((text, idx) => ({
            id: String.fromCharCode(65 + idx),
            text: text.trim().replace(/^[A-D]\s*[.:)]\s*/i, '')
        }));

        questions.push({
            id: generateId(),
            text: qText + '?',
            options,
            correct_option_id: answer,
        });
    }
    return questions;
};
