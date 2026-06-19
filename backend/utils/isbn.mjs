/**
 * Утилиты для работы с ISBN (International Standard Book Number)
 * 
 * Назначение:
 * - Нормализация ISBN из разных форматов
 * - Валидация ISBN
 * - Извлечение года из текста
 * - Дедупликация строк
 * 
 * Используется во всех модулях-источниках данных для приведения
 * ISBN к единому формату перед сравнением и сохранением
 */

/**
 * Нормализация ISBN
 * @param {string} value - Строка с ISBN в любом формате
 * @returns {string} - Нормализованный ISBN или пустая строка
 * 
 * Алгоритм нормализации:
 * 1. Удаляет все символы, кроме цифр и буквы X
 * 2. Приводит X к верхнему регистру
 * 3. Проверяет соответствие форматам:
 *    - ISBN-13: 13 цифр, начинается с 978 или 979
 *    - ISBN-10: 10 символов (9 цифр + контрольная цифра или X)
 * 4. Возвращает нормализованный ISBN или пустую строку
 * 
 * Особенности:
 * - Поддерживает оба формата ISBN (10 и 13 цифр)
 * - Игнорирует дефисы, пробелы и другие разделители
 * - Возвращает ISBN-10 как есть (не конвертирует в ISBN-13)
 * 
 * Примеры:
 * normalizeIsbn('978-5-17-123456-7') → '9785171234567'
 * normalizeIsbn('5-17-123456-7') → '5171234567'
 * normalizeIsbn('0-306-40615-2') → '0306406152'
 * normalizeIsbn('invalid') → ''
 */
export function normalizeIsbn(value = '') {
  // Удаляем все символы, кроме цифр и X, приводим X к верхнему регистру
  const cleaned = String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
  
  // Проверяем ISBN-13: 13 цифр, начинается с 978 или 979
  if (cleaned.length === 13 && /^(978|979)\d{10}$/.test(cleaned)) return cleaned;
  
  // Проверяем ISBN-10: 10 символов (9 цифр + цифра или X)
  if (cleaned.length === 10 && /^\d{9}[0-9X]$/.test(cleaned)) return cleaned;
  
  // Возвращаем частичный ISBN только если он достаточно длинный (>=8 символов)
  return cleaned.length >= 8 ? cleaned : '';
}

/**
 * Проверка, похожа ли строка на ISBN
 * @param {string} value - Строка для проверки
 * @returns {boolean} - true если строка похожа на ISBN
 * 
 * Используется для быстрой проверки перед вызовом normalizeIsbn
 * 
 * Примеры:
 * looksLikeIsbn('978-5-17-123456-7') → true
 * looksLikeIsbn('5-17-123456-7') → true
 * looksLikeIsbn('Война и мир') → false
 */
export function looksLikeIsbn(value = '') {
  const normalized = normalizeIsbn(value);
  return normalized.length === 10 || normalized.length === 13;
}

/**
 * Извлечение года из текста
 * @param {string} value - Текст для поиска года
 * @returns {number|undefined} - Найденный год или undefined
 * 
 * Ищет годы в диапазоне:
 * - 1500-1999 (1[5-9]\d{2})
 * - 2000-2099 (20\d{2})
 * 
 * Особенности:
 * - Находит только 4-значные годы
 * - Игнорирует года вне диапазона (например, 1234 или 3000)
 * - Возвращает число, а не строку
 * 
 * Примеры:
 * parseYear('Published in 2024') → 2024
 * parseYear('Год издания: 2019') → 2019
 * parseYear('1234 год') → undefined
 * parseYear('') → undefined
 */
export function parseYear(value = '') {
  // Ищем год: 1500-1999 или 2000-2099
  const year = String(value).match(/\b(1[5-9]\d{2}|20\d{2})\b/)?.[0];
  return year ? Number(year) : undefined;
}

/**
 * Дедупликация строк с учетом регистра
 * @param {Array} values - Массив строк
 * @returns {Array} - Массив уникальных строк
 * 
 * Алгоритм:
 * 1. Проходит по всем значениям
 * 2. Приводит каждое к нижнему регистру для сравнения (русская локаль)
 * 3. Сохраняет первое встреченное написание
 * 4. Возвращает массив уникальных строк
 * 
 * Особенности:
 * - Учитывает регистр при сохранении (сохраняет оригинальное написание)
 * - Игнорирует пустые строки
 * - Использует русскую локаль для корректного сравнения
 * 
 * Примеры:
 * uniqueStrings(['Толстой', 'толстой', 'Толстой']) → ['Толстой']
 * uniqueStrings(['   Толстой  ', 'Толстой']) → ['Толстой']
 * uniqueStrings(['', 'Толстой', '']) → ['Толстой']
 * uniqueStrings(['Пушкин', 'Толстой', 'Пушкин']) → ['Пушкин', 'Толстой']
 */
export function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  
  for (const value of values) {
    // Нормализуем значение (удаляем пробелы)
    const normalized = String(value || '').trim();
    
    // Создаем ключ для сравнения (нижний регистр, русская локаль)
    const key = normalized.toLocaleLowerCase('ru-RU');
    
    // Пропускаем пустые строки и дубликаты
    if (!normalized || seen.has(key)) continue;
    
    // Добавляем в множество и результат
    seen.add(key);
    result.push(normalized);
  }
  
  return result;
}